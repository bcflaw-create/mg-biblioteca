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
  const [barcode, setBarcode] = useState('');
  const [itemType, setItemType] = useState('libro');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
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
    genre: ''
  });
  const [filter, setFilter] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [yearFilter, setYearFilter] = useState('todos');
  const barcodeInputRef = useRef(null);

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

  const searchBarcodeAuto = async (code) => {
    if (!code.trim() || code.length < 5) return;
    
    setSearching(true);
    try {
      if (itemType === 'libro') {
        const { data } = await axios.get(`https://openlibrary.org/api/books?bibkeys=ISBN:${code}&format=json&jscmd=data`);
        const bookData = data[`ISBN:${code}`];
        
        if (bookData) {
          setFormData(prev => ({
            ...prev,
            title: bookData.title || '',
            author: bookData.authors?.[0]?.name || '',
            year: bookData.publish_date?.slice(-4) || '',
            cover_url: bookData.cover?.medium || '',
            isbn: code,
            publisher: bookData.publishers?.[0]?.name || '',
            pages: bookData.number_of_pages?.toString() || ''
          }));
          setSearchResults({ found: true, type: 'libro', data: bookData });
        } else {
          searchGoogleBooks(code);
        }
      }
    } catch (error) {
      console.error('Error searching:', error);
      if (itemType === 'libro') {
        searchGoogleBooks(code);
      }
    }
    setSearching(false);
  };

  const searchGoogleBooks = async (isbn) => {
    try {
      const { data } = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      if (data.items && data.items.length > 0) {
        const book = data.items[0].volumeInfo;
        setFormData(prev => ({
          ...prev,
          title: book.title || '',
          author: book.authors?.[0] || '',
          year: book.publishedDate?.slice(0, 4) || '',
          cover_url: book.imageLinks?.thumbnail || '',
          isbn: isbn,
          publisher: book.publisher || '',
          pages: book.pageCount?.toString() || '',
          category: book.categories?.[0] || ''
        }));
        setSearchResults({ found: true, type: 'libro', data: book });
      } else {
        setSearchResults({ found: false, type: 'libro' });
      }
    } catch (error) {
      console.error('Google Books error:', error);
      setSearchResults({ found: false, type: 'libro', error: true });
    }
  };

  const handleBarcodeChange = (e) => {
    const value = e.target.value;
    setBarcode(value);
    
    if (value.length >= 10 && value.length <= 13) {
      searchBarcodeAuto(value);
    }
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
      barcode: barcode || null,
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
      genre: formData.genre || null
    }]);

    if (error) alert('Error al guardar: ' + error.message);
    else {
      alert('Item guardado exitosamente');
      setBarcode('');
      setFormData({ 
        title: '', author: '', year: '', category: '', condition: 'bueno', 
        location: '', cover_url: '', notes: '', format: 'dvd', isbn: '', 
        publisher: '', pages: '', genre: '' 
      });
      setSearchResults(null);
      fetchItems();
      barcodeInputRef.current?.focus();
    }
  };

  const deleteItem = async (id) => {
    if (window.confirm('¿Eliminar este item?')) {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) alert('Error: ' + error.message);
      else fetchItems();
    }
  };

  const exportToExcel = () => {
    const dataToExport = getFilteredItems().map(item => ({
      'Tipo': item.type === 'libro' ? 'Libro' : 'Película',
      'Título': item.title,
      'Autor/Director': item.author,
      'Año': item.year,
      'Categoría': item.category,
      'Condición': item.condition,
      'Ubicación': item.location,
      'ISBN': item.isbn || '',
      'Editorial': item.publisher || '',
      'Páginas': item.pages || '',
      'Género': item.genre || '',
      'Notas': item.notes
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Biblioteca');
    XLSX.writeFile(wb, `biblioteca_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getFilteredItems = () => {
    let filtered = filter === 'todos' ? items : items.filter(item => item.type === filter);
    
    if (categoryFilter !== 'todos') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }
    
    if (yearFilter !== 'todos') {
      filtered = filtered.filter(item => item.year === parseInt(yearFilter));
    }
    
    return filtered;
  };

  const getCategories = () => {
    const categories = new Set(items.filter(i => i.category).map(i => i.category));
    return Array.from(categories).sort();
  };

  const getYears = () => {
    const years = new Set(items.filter(i => i.year).map(i => i.year));
    return Array.from(years).sort((a, b) => b - a);
  };

  const filteredItems = getFilteredItems();

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
        <div className="header-left">
          <h1 className="logo">MG</h1>
          <span className="tagline-header">biblioteca personal</span>
        </div>
        <div className="header-right">
          <button onClick={exportToExcel} className="export-btn" title="Exportar a Excel">
            📊 Exportar
          </button>
          <button onClick={handleLogout} className="logout-btn">Cerrar sesión</button>
        </div>
      </header>

      <div className="plex-container">
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <div className="nav-section">
              <h3 className="nav-title">Menú</h3>
              <button className="nav-item active">
                🏠 Inicio
              </button>
              <button className="nav-item">
                ⭐ Favoritos
              </button>
              <button className="nav-item">
                👁️ Visto Recientemente
              </button>
            </div>

            <div className="nav-section">
              <h3 className="nav-title">Bibliotecas</h3>
              <button 
                className={`nav-item ${filter === 'todos' ? 'active' : ''}`}
                onClick={() => setFilter('todos')}
              >
                📚 Todos ({items.length})
              </button>
              <button 
                className={`nav-item ${filter === 'libro' ? 'active' : ''}`}
                onClick={() => setFilter('libro')}
              >
                📖 Libros ({items.filter(i => i.type === 'libro').length})
              </button>
              <button 
                className={`nav-item ${filter === 'película' ? 'active' : ''}`}
                onClick={() => setFilter('película')}
              >
                🎬 Películas ({items.filter(i => i.type === 'película').length})
              </button>
            </div>

            <div className="nav-section">
              <h3 className="nav-title">Categorías</h3>
              <select 
                className="filter-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="todos">Todas las categorías</option>
                {getCategories().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="nav-section">
              <h3 className="nav-title">Años</h3>
              <select 
                className="filter-select"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              >
                <option value="todos">Todos los años</option>
                {getYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </nav>
        </aside>

        <main className="plex-main">
          <section className="add-item-section">
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

            <div className="barcode-form">
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder={itemType === 'libro' ? 'Escanea ISBN o código de barras' : 'Escanea código'}
                value={barcode}
                onChange={handleBarcodeChange}
                className="barcode-input"
                disabled={searching}
              />
              {searching && <span className="searching-indicator">Buscando...</span>}
            </div>

            {searchResults && (
              <div className={`search-result ${searchResults.found ? 'found' : 'not-found'}`}>
                {searchResults.found ? (
                  <p>✓ Encontrado automáticamente. Revisa los detalles abajo.</p>
                ) : (
                  <p>✗ No encontrado. Completa manualmente.</p>
                )}
              </div>
            )}

            <form onSubmit={saveItem} className="item-form">
              <div className="form-group">
                <label>Título *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Autor / Director</label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
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

              <div className="form-row">
                <div className="form-group">
                  <label>Categoría</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder={itemType === 'libro' ? 'Novela, Técnico...' : 'Acción, Drama...'}
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

              {itemType === 'libro' && (
                <>
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
                      <label>Páginas</label>
                      <input
                        type="number"
                        value={formData.pages}
                        onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Género</label>
                      <input
                        type="text"
                        value={formData.genre}
                        onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {itemType === 'película' && (
                <div className="form-group">
                  <label>Formato</label>
                  <select
                    value={formData.format}
                    onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                  >
                    <option value="dvd">DVD</option>
                    <option value="bluray">Blu-ray</option>
                    <option value="digital">Digital</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Ubicación</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Estante, piso, etc."
                />
              </div>

              <div className="form-group">
                <label>Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="2"
                />
              </div>

              <button type="submit" className="save-btn">Guardar</button>
            </form>
          </section>

          <section className="library-section">
            <div className="library-header">
              <h2>{filter === 'todos' ? 'Mi Biblioteca' : filter === 'libro' ? 'Mis Libros' : 'Mis Películas'}</h2>
              <span className="item-count">{filteredItems.length} items</span>
            </div>

            {filteredItems.length > 0 ? (
              <div className="plex-grid">
                {filteredItems.map(item => (
                  <div key={item.id} className="plex-item">
                    <div className="plex-poster">
                      {item.cover_url ? (
                        <img src={item.cover_url} alt={item.title} />
                      ) : (
                        <div className="no-cover">
                          <span>{item.type === 'libro' ? '📚' : '🎬'}</span>
                        </div>
                      )}
                      <div className="plex-overlay">
                        <button 
                          className="delete-btn-plex"
                          onClick={() => deleteItem(item.id)}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                    <div className="plex-info">
                      <h3>{item.title}</h3>
                      {item.author && <p className="author">{item.author}</p>}
                      {item.year && <p className="year">{item.year}</p>}
                      {item.category && <p className="category">{item.category}</p>}
                      {item.publisher && <p className="publisher">{item.publisher}</p>}
                      <p className={`condition condition-${item.condition}`}>{item.condition}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No hay items con estos filtros. ¡Agrega tu primer {filter === 'libro' ? 'libro' : filter === 'película' ? 'película' : 'item'}!</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;