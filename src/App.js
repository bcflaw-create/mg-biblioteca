import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as XLSX from 'xlsx';
import './App.css';

const supabaseUrl = 'https://anyxfgqbxmcaibihckgk.supabase.co';
const supabaseKey = 'sb_publishable_Y6IpeoZtMBzBMsfhUfI7PQ_JVI7-esY';
const tmdbApiKey = '7f314794a2f3e443f9a8952fec2d31b3';

const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [itemType, setItemType] = useState('película');
  const [posterSize, setPosterSize] = useState(200);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    year: '',
    category: '',
    condition: 'bueno',
    location: '',
    cover_url: '',
    notes: '',
    format: 'dvd',
    isbn: '',
    publisher: '',
    pages: '',
    genre: '',
    director: '',
    actors: '',
    duration: '',
    rating: '',
    synopsis: ''
  });
  const [searching, setSearching] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const searchInputRef = useRef(null);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching items:', error);
    else setItems(data || []);
  };

  const checkUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) fetchItems();
  }, []);

  useEffect(() => {
    checkUser();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchItems();
      }
    });
    return () => {
      if (data?.subscription) {
        data.subscription.unsubscribe();
      }
    };
  }, [checkUser]);

  useEffect(() => {
    filterItems();
  }, [items, searchQuery, categoryFilter, itemType]);

  const filterItems = () => {
    let filtered = itemType === 'todos' ? items : items.filter(i => i.type === itemType);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.title?.toLowerCase().includes(query) ||
        item.author?.toLowerCase().includes(query) ||
        item.director?.toLowerCase().includes(query) ||
        item.isbn?.includes(query) ||
        item.category?.toLowerCase().includes(query)
      );
    }

    if (categoryFilter !== 'todos') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    setFilteredItems(filtered);
  };

  const searchGoogleBooks = async (isbn) => {
    try {
      const { data } = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      if (data.items && data.items.length > 0) {
        const book = data.items[0].volumeInfo;
        return {
          title: book.title || '',
          author: book.authors?.[0] || '',
          year: book.publishedDate?.slice(0, 4) || '',
          cover_url: book.imageLinks?.thumbnail || '',
          publisher: book.publisher || '',
          pages: book.pageCount?.toString() || '',
          category: book.categories?.[0] || '',
          synopsis: book.description || ''
        };
      }
    } catch (error) {
      console.error('Google Books error:', error);
    }
    return null;
  };

  const searchOpenLibrary = async (isbn) => {
    try {
      const { data } = await axios.get(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const bookData = data[`ISBN:${isbn}`];
      if (bookData) {
        return {
          title: bookData.title || '',
          author: bookData.authors?.[0]?.name || '',
          year: bookData.publish_date?.slice(-4) || '',
          cover_url: bookData.cover?.medium || '',
          publisher: bookData.publishers?.[0]?.name || '',
          pages: bookData.number_of_pages?.toString() || ''
        };
      }
    } catch (error) {
      console.error('OpenLibrary error:', error);
    }
    return null;
  };

  const getTmdbMovieDetails = async (movieId) => {
    try {
      const { data } = await axios.get(
        `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}&language=es-MX`
      );
      
      const credits = await axios.get(
        `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${tmdbApiKey}`
      );

      const director = credits.data.crew?.find(c => c.job === 'Director')?.name || '';
      const actors = credits.data.cast?.slice(0, 5).map(a => a.name).join(', ') || '';

      return {
        title: data.title || '',
        year: data.release_date?.slice(0, 4) || '',
        cover_url: data.poster_path ? `https://image.tmdb.org/t/p/w300${data.poster_path}` : '',
        synopsis: data.overview || '',
        rating: data.vote_average?.toFixed(1) || '',
        category: data.genres?.map(g => g.name).join(', ') || '',
        director: director,
        actors: actors,
        duration: data.runtime?.toString() || ''
      };
    } catch (error) {
      console.error('TMDb details error:', error);
      return null;
    }
  };

  const searchMovieTmdb = async (title) => {
    try {
      const { data } = await axios.get(
        `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${title}&language=es-MX`
      );
      
      if (data.results && data.results.length > 0) {
        const movie = data.results[0];
        // Obtener detalles completos
        const fullDetails = await getTmdbMovieDetails(movie.id);
        return fullDetails;
      }
    } catch (error) {
      console.error('TMDb search error:', error);
    }
    return null;
  };

  const handleBarcodeSearch = async (e) => {
    if (e.key !== 'Enter') return;
    
    const barcode = e.target.value.trim();
    if (!barcode || barcode.length < 5) return;

    setSearching(true);
    let result = null;

    if (itemType === 'libro') {
      result = await searchOpenLibrary(barcode);
      if (!result) {
        result = await searchGoogleBooks(barcode);
      }
    }

    if (result) {
      setFormData(prev => ({ ...prev, ...result, isbn: barcode }));
    }
    
    setSearching(false);
  };

  const handleTitleSearch = async (e) => {
    if (e.key !== 'Enter') return;

    const title = e.target.value.trim();
    if (!title || title.length < 3) return;

    setSearching(true);
    let result = null;

    if (itemType === 'película') {
      result = await searchMovieTmdb(title);
    }

    if (result) {
      setFormData(prev => ({ ...prev, ...result }));
    }

    setSearching(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Error al iniciar sesión: ' + error.message);
    else {
      setEmail('');
      setPassword('');
    }
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert('Error al crear cuenta: ' + error.message);
    else alert('Cuenta creada. Revisa tu email para confirmar.');
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setItems([]);
  };

  const saveItem = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('El título es obligatorio');
      return;
    }

    const { error } = await supabase.from('items').insert([{
      user_id: user.id,
      type: itemType,
      title: formData.title,
      author: formData.author,
      year: formData.year ? parseInt(formData.year) : null,
      category: formData.category,
      condition: formData.condition,
      location: formData.location,
      cover_url: formData.cover_url,
      notes: formData.notes,
      format: itemType === 'película' ? formData.format : null,
      isbn: formData.isbn || null,
      publisher: formData.publisher || null,
      pages: formData.pages ? parseInt(formData.pages) : null,
      genre: formData.genre || null,
      director: formData.director || null,
      actors: formData.actors || null,
      duration: formData.duration || null,
      rating: formData.rating ? parseFloat(formData.rating) : null,
      synopsis: formData.synopsis || null
    }]);

    if (error) alert('Error al guardar: ' + error.message);
    else {
      alert('Item guardado exitosamente');
      setFormData({
        title: '', author: '', year: '', category: '', condition: 'bueno',
        location: '', cover_url: '', notes: '', format: 'dvd', isbn: '',
        publisher: '', pages: '', genre: '', director: '', actors: '',
        duration: '', rating: '', synopsis: ''
      });
      setShowAddForm(false);
      fetchItems();
    }
  };

  const deleteItem = async (id) => {
    if (window.confirm('¿Eliminar este item?')) {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) alert('Error: ' + error.message);
      else {
        fetchItems();
        setSelectedItem(null);
      }
    }
  };

  const exportToExcel = () => {
    const dataToExport = filteredItems.map(item => ({
      'Tipo': item.type === 'libro' ? 'Libro' : 'Película',
      'Título': item.title,
      'Autor/Director': item.author || item.director || '',
      'Año': item.year,
      'Categoría': item.category,
      'Condición': item.condition,
      'Ubicación': item.location,
      'ISBN': item.isbn || '',
      'Editorial': item.publisher || '',
      'Páginas': item.pages || '',
      'Actores': item.actors || '',
      'Duración': item.duration || '',
      'Rating': item.rating || '',
      'Notas': item.notes
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Biblioteca');
    XLSX.writeFile(wb, `biblioteca_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getCategories = () => {
    const categories = new Set(items.filter(i => i.category).map(i => i.category));
    return Array.from(categories).sort();
  };

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1 className="logo">MG</h1>
          <p className="tagline">Tu biblioteca personal</p>
          
          <form onSubmit={handleLogin} className="form">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Cargando...' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="divider">o</p>

          <button 
            className="signup-btn"
            onClick={handleSignUp}
            disabled={loading}
          >
            {loading ? 'Cargando...' : 'Crear nueva cuenta'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          ☰
        </button>
        <h1 className="logo">MG</h1>
        <div className="header-actions">
          <button onClick={() => setShowAddForm(true)} className="add-btn" title="Agregar nuevo item">
            +
          </button>
          <button onClick={exportToExcel} className="export-btn">📊</button>
          <button onClick={handleLogout} className="logout-btn">Salir</button>
        </div>
      </header>

      <div className="search-bar-container">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="🔍 Busca por título, autor, director, ISBN, categoría..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-bar"
        />
      </div>

      <div className="main-layout">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-content">
            <div className="type-selector-sidebar">
              <button
                className={`type-btn-sidebar ${itemType === 'todos' ? 'active' : ''}`}
                onClick={() => { setItemType('todos'); setSidebarOpen(false); }}
              >
                📚 Todos
              </button>
              <button
                className={`type-btn-sidebar ${itemType === 'libro' ? 'active' : ''}`}
                onClick={() => { setItemType('libro'); setSidebarOpen(false); }}
              >
                📖 Libros
              </button>
              <button
                className={`type-btn-sidebar ${itemType === 'película' ? 'active' : ''}`}
                onClick={() => { setItemType('película'); setSidebarOpen(false); }}
              >
                🎬 Películas
              </button>
            </div>

            <div className="filter-section">
              <label>Categorías</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="todos">Todas</option>
                {getCategories().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="stats">
              <p>Total: <strong>{items.length}</strong></p>
              <p>Libros: <strong>{items.filter(i => i.type === 'libro').length}</strong></p>
              <p>Películas: <strong>{items.filter(i => i.type === 'película').length}</strong></p>
            </div>
          </div>
        </aside>

        <main className="content">
          <div className="toolbar">
            <div className="toolbar-left">
              <span className="result-count">{filteredItems.length} items</span>
            </div>
            <div className="toolbar-right">
              <label className="size-label">Tamaño:</label>
              <input
                type="range"
                min="120"
                max="300"
                value={posterSize}
                onChange={(e) => setPosterSize(parseInt(e.target.value))}
                className="size-slider"
              />
              <span className="size-value">{posterSize}px</span>
            </div>
          </div>

          <div className="gallery-section">
            <div className="gallery-grid" style={{ '--poster-size': `${posterSize}px` }}>
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    className="gallery-item"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="poster">
                      {item.cover_url ? (
                        <img src={item.cover_url} alt={item.title} />
                      ) : (
                        <div className="no-poster">
                          {item.type === 'libro' ? '📚' : '🎬'}
                        </div>
                      )}
                      <div className="poster-overlay">
                        <button
                          className="delete-poster"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteItem(item.id);
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="poster-title">{item.title}</div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  No hay items con estos criterios. Haz clic en + para agregar uno.
                </div>
              )}
            </div>
          </div>
        </main>

        {selectedItem && (
          <div className="detail-panel">
            <button className="close-detail" onClick={() => setSelectedItem(null)}>×</button>
            
            <div className="detail-content">
              {selectedItem.cover_url && (
                <img src={selectedItem.cover_url} alt={selectedItem.title} className="detail-cover" />
              )}
              
              <h2>{selectedItem.title}</h2>
              
              {selectedItem.type === 'libro' ? (
                <>
                  {selectedItem.author && <p><strong>Autor:</strong> {selectedItem.author}</p>}
                  {selectedItem.publisher && <p><strong>Editorial:</strong> {selectedItem.publisher}</p>}
                  {selectedItem.isbn && <p><strong>ISBN:</strong> {selectedItem.isbn}</p>}
                  {selectedItem.pages && <p><strong>Páginas:</strong> {selectedItem.pages}</p>}
                </>
              ) : (
                <>
                  {selectedItem.director && <p><strong>Director:</strong> {selectedItem.director}</p>}
                  {selectedItem.actors && <p><strong>Actores:</strong> {selectedItem.actors}</p>}
                  {selectedItem.duration && <p><strong>Duración:</strong> {selectedItem.duration} min</p>}
                  {selectedItem.rating && <p><strong>Rating:</strong> {selectedItem.rating}/10 ⭐</p>}
                </>
              )}

              {selectedItem.year && <p><strong>Año:</strong> {selectedItem.year}</p>}
              {selectedItem.category && <p><strong>Categoría:</strong> {selectedItem.category}</p>}
              {selectedItem.location && <p><strong>Ubicación:</strong> {selectedItem.location}</p>}
              {selectedItem.condition && <p><strong>Condición:</strong> {selectedItem.condition}</p>}
              
              {selectedItem.synopsis && (
                <>
                  <h4>Descripción</h4>
                  <p>{selectedItem.synopsis}</p>
                </>
              )}

              {selectedItem.notes && (
                <>
                  <h4>Notas</h4>
                  <p>{selectedItem.notes}</p>
                </>
              )}

              <button
                className="delete-btn-detail"
                onClick={() => {
                  deleteItem(selectedItem.id);
                }}
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAddForm(false)}>×</button>
            
            <h2>Agregar nuevo item</h2>
            
            <div className="type-selector">
              <button
                className={`type-btn ${itemType === 'libro' ? 'active' : ''}`}
                onClick={() => setItemType('libro')}
              >
                📚 Libro
              </button>
              <button
                className={`type-btn ${itemType === 'película' ? 'active' : ''}`}
                onClick={() => setItemType('película')}
              >
                🎬 Película
              </button>
            </div>

            <form onSubmit={saveItem} className="add-form">
              {itemType === 'libro' ? (
                <>
                  <div className="form-group">
                    <label>ISBN o Título (Presiona Enter para buscar)</label>
                    <input
                      type="text"
                      placeholder="Escanea ISBN o escribe título"
                      onKeyPress={handleBarcodeSearch}
                      disabled={searching}
                    />
                    {searching && <span className="searching">Buscando...</span>}
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Título de la película (Presiona Enter para buscar)</label>
                    <input
                      type="text"
                      placeholder="Escribe el título"
                      onKeyPress={handleTitleSearch}
                      disabled={searching}
                    />
                    {searching && <span className="searching">Buscando en TMDb...</span>}
                  </div>
                </>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Título *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Año</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  />
                </div>
              </div>

              {itemType === 'libro' ? (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Autor</label>
                      <input
                        type="text"
                        value={formData.author}
                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Editorial</label>
                      <input
                        type="text"
                        value={formData.publisher}
                        onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>ISBN</label>
                      <input
                        type="text"
                        value={formData.isbn}
                        onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Páginas</label>
                      <input
                        type="number"
                        value={formData.pages}
                        onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Director</label>
                      <input
                        type="text"
                        value={formData.director}
                        onChange={(e) => setFormData({ ...formData, director: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Rating (0-10)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={formData.rating}
                        onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Actores</label>
                    <input
                      type="text"
                      value={formData.actors}
                      onChange={(e) => setFormData({ ...formData, actors: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Duración (min)</label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Categoría</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder={itemType === 'libro' ? 'Novela, Técnico...' : 'Drama, Acción...'}
                  />
                </div>
                <div className="form-group">
                  <label>Condición</label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  >
                    <option value="nuevo">Nuevo</option>
                    <option value="bueno">Bueno</option>
                    <option value="regular">Regular</option>
                    <option value="usado">Usado</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Ubicación</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Estante, piso..."
                />
              </div>

              <div className="form-group">
                <label>Sinopsis / Notas</label>
                <textarea
                  value={formData.synopsis || formData.notes}
                  onChange={(e) => setFormData({ ...formData, synopsis: e.target.value, notes: e.target.value })}
                  rows="3"
                />
              </div>

              <button type="submit" className="save-btn">Guardar Item</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;