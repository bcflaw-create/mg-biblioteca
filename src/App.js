import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
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
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    year: '',
    category: '',
    condition: 'bueno',
    location: '',
    cover_url: '',
    notes: '',
    format: 'dvd'
  });
  const [filter, setFilter] = useState('todos');
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

  const searchBarcode = async (code) => {
    if (!code.trim()) return;
    
    try {
      if (itemType === 'libro') {
        const { data } = await axios.get(`https://openlibrary.org/api/books?bibkeys=ISBN:${code}&format=json&jscmd=data`);
        const bookData = data[`ISBN:${code}`];
        if (bookData) {
          setFormData({
            title: bookData.title || '',
            author: bookData.authors?.[0]?.name || '',
            year: bookData.publish_date?.slice(-4) || '',
            category: '',
            condition: 'bueno',
            location: '',
            cover_url: bookData.cover?.medium || '',
            notes: ''
          });
          setSearchResults({ found: true, type: 'libro', data: bookData });
        } else {
          setSearchResults({ found: false, type: 'libro' });
        }
      } else {
        const { data } = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${code}`);
        if (data.results.length > 0) {
          const movie = data.results[0];
          setFormData({
            title: movie.title || '',
            author: movie.genres?.map(g => g.name).join(', ') || '',
            year: movie.release_date?.slice(0, 4) || '',
            category: '',
            condition: 'bueno',
            location: '',
            cover_url: movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : '',
            notes: movie.overview || ''
          });
          setSearchResults({ found: true, type: 'película', data: movie });
        } else {
          setSearchResults({ found: false, type: 'película' });
        }
      }
    } catch (error) {
      console.error('Error searching:', error);
      setSearchResults({ found: false, error: true });
    }
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (barcode.trim()) {
      searchBarcode(barcode);
    }
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
    }]);

    if (error) alert('Error al guardar: ' + error.message);
    else {
      alert('Item guardado exitosamente');
      setBarcode('');
      setFormData({ title: '', author: '', year: '', category: '', condition: 'bueno', location: '', cover_url: '', notes: '' });
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

  const filteredItems = filter === 'todos' ? items : items.filter(item => item.type === filter);

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
        <h1 className="logo">MG</h1>
        <button onClick={handleLogout} className="logout-btn">Cerrar sesión</button>
      </header>

      <main className="main-content">
        <section className="scanner-section">
          <h2>Agregar item</h2>
          
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

          <form onSubmit={handleBarcodeSubmit} className="barcode-form">
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Escanea código de barras o ISBN"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="barcode-input"
              autoFocus
            />
            <button type="submit" className="scan-btn">Buscar</button>
          </form>

          {searchResults && (
            <div className={`search-result ${searchResults.found ? 'found' : 'not-found'}`}>
              {searchResults.found ? (
                <p>✓ Información encontrada. Completa los detalles abajo.</p>
              ) : (
                <p>✗ No se encontraron resultados. Completa manualmente.</p>
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
            </div>

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
                rows="3"
              />
            </div>

            <button type="submit" className="save-btn">Guardar</button>
          </form>
        </section>

        <section className="library-section">
          <h2>Mi biblioteca</h2>
          
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'todos' ? 'active' : ''}`}
              onClick={() => setFilter('todos')}
            >
              Todos ({items.length})
            </button>
            <button
              className={`filter-tab ${filter === 'libro' ? 'active' : ''}`}
              onClick={() => setFilter('libro')}
            >
              Libros ({items.filter(i => i.type === 'libro').length})
            </button>
            <button
              className={`filter-tab ${filter === 'película' ? 'active' : ''}`}
              onClick={() => setFilter('película')}
            >
              Películas ({items.filter(i => i.type === 'película').length})
            </button>
          </div>

          <div className="items-grid">
            {filteredItems.length > 0 ? (
              filteredItems.map(item => (
                <div key={item.id} className="item-card">
                  {item.cover_url && (
                    <img src={item.cover_url} alt={item.title} className="cover" />
                  )}
                  <div className="item-info">
                    <h3>{item.title}</h3>
                    {item.author && <p className="author">{item.author}</p>}
                    {item.year && <p className="year">{item.year}</p>}
                    {item.category && <p className="category">{item.category}</p>}
                    {item.location && <p className="location">📍 {item.location}</p>}
                    <p className={`condition condition-${item.condition}`}>{item.condition}</p>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="delete-btn"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">No hay items. ¡Agrega tu primer libro o película!</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
