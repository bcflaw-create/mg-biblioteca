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
  const [editingItem, setEditingItem] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [itemType, setItemType] = useState('película');
  const [posterSize, setPosterSize] = useState(180);
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
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showDashboard, setShowDashboard] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [watchlistTitle, setWatchlistTitle] = useState('');
  const [watchlistFormat, setWatchlistFormat] = useState('cine');
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

  const filterItems = useCallback(() => {
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
  }, [items, searchQuery, categoryFilter, itemType]);

  useEffect(() => {
    filterItems();
  }, [filterItems]);

  useEffect(() => {
    if (user?.id) {
      fetchWatchlist();
    }
  }, [user?.id, fetchWatchlist]);

  const searchGoogleBooks = async (query) => {
    try {
      const searchQuery = /^[0-9-]{10,}$/.test(query) ? `isbn:${query}` : query;
      const { data } = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=1`);
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
          synopsis: book.description || '',
          isbn: book.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier || ''
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
    
    const query = e.target.value.trim();
    if (!query || query.length < 3) return;

    setSearching(true);
    let result = null;

    if (itemType === 'libro') {
      const isISBN = /^[0-9-]{10,}$/.test(query); // ISBN tiene solo números y guiones
      
      if (isISBN) {
        // Si parece ISBN, busca por ISBN primero
        result = await searchOpenLibrary(query);
        if (!result) {
          result = await searchGoogleBooks(query);
        }
      } else {
        // Si es texto, busca por título en ambas APIs
        result = await searchGoogleBooks(query); // Google Books busca por título
        if (!result) {
          result = await searchOpenLibrary(query);
        }
      }
    }

    if (result) {
      setFormData(prev => ({ ...prev, ...result }));
      e.target.value = ''; // Limpia el campo después de buscar
    } else {
      alert('No se encontró el libro. Intenta con otro ISBN o título.');
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

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const captureModal = document.createElement('div');
      captureModal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: black; z-index: 10000; display: flex;
        flex-direction: column; align-items: center; justify-content: center;
      `;
      
      video.style.cssText = `width: 100%; max-height: 80%; object-fit: contain;`;
      
      const captureBtn = document.createElement('button');
      captureBtn.textContent = '📸 Capturar';
      captureBtn.style.cssText = `
        margin-top: 20px; padding: 10px 20px; 
        font-size: 16px; background: #4CAF50; color: white;
        border: none; border-radius: 5px; cursor: pointer;
      `;

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '❌ Cerrar';
      closeBtn.style.cssText = `
        margin-top: 10px; padding: 10px 20px;
        font-size: 16px; background: #f44336; color: white;
        border: none; border-radius: 5px; cursor: pointer;
      `;

      captureBtn.onclick = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setFormData(prev => ({ ...prev, cover_url: imageData }));
        
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(captureModal);
      };

      closeBtn.onclick = () => {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(captureModal);
      };

      captureModal.appendChild(video);
      captureModal.appendChild(captureBtn);
      captureModal.appendChild(closeBtn);
      document.body.appendChild(captureModal);
    } catch (error) {
      alert('No se puede acceder a la cámara: ' + error.message);
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

    try {
      const itemData = {
        user_id: user.id,
        type: itemType,
        title: formData.title,
        author: formData.author || null,
        year: formData.year ? parseInt(formData.year) : null,
        category: formData.category || null,
        condition: formData.condition,
        location: formData.location || null,
        cover_url: formData.cover_url || null,
        notes: formData.notes || null,
        format: itemType === 'película' ? formData.format : null,
        isbn: formData.isbn || null,
        publisher: formData.publisher || null,
        pages: formData.pages ? parseInt(formData.pages) : null,
        genre: formData.genre || null,
        director: formData.director || null,
        duration: formData.duration || null,
        rating: formData.rating ? parseFloat(formData.rating) : null,
        synopsis: formData.synopsis || null
      };

      // Agregar actors solo si existe la columna
      if (formData.actors) {
        itemData.actors = formData.actors;
      }

      const { error } = await supabase.from('items').insert([itemData]);

      if (error) {
        // Si el error es por columna inexistente, intenta sin esa columna
        if (error.message.includes('actors')) {
          const { actor, ...itemDataWithoutActors } = itemData;
          const { error: retryError } = await supabase.from('items').insert([itemDataWithoutActors]);
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      alert('Item guardado exitosamente');
      setFormData({
        title: '', author: '', year: '', category: '', condition: 'bueno',
        location: '', cover_url: '', notes: '', format: 'dvd', isbn: '',
        publisher: '', pages: '', genre: '', director: '', actors: '',
        duration: '', rating: '', synopsis: ''
      });
      setShowAddForm(false);
      fetchItems();
    } catch (error) {
      alert('Error al guardar: ' + error.message);
      console.error('Save error:', error);
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

  const updateItem = async (e) => {
    e.preventDefault();
    if (!editingItem.title.trim()) {
      alert('El título es obligatorio');
      return;
    }

    try {
      const updateData = {
        title: editingItem.title,
        author: editingItem.author || null,
        year: editingItem.year ? parseInt(editingItem.year) : null,
        category: editingItem.category || null,
        condition: editingItem.condition,
        location: editingItem.location || null,
        cover_url: editingItem.cover_url || null,
        notes: editingItem.notes || null,
        isbn: editingItem.isbn || null,
        publisher: editingItem.publisher || null,
        pages: editingItem.pages ? parseInt(editingItem.pages) : null,
        genre: editingItem.genre || null,
        director: editingItem.director || null,
        actors: editingItem.actors || null,
        duration: editingItem.duration || null,
        rating: editingItem.rating ? parseFloat(editingItem.rating) : null,
        synopsis: editingItem.synopsis || null
      };

      const { error } = await supabase
        .from('items')
        .update(updateData)
        .eq('id', editingItem.id);

      if (error) {
        if (error.message.includes('actors')) {
          const { actor, ...updateDataWithoutActors } = updateData;
          const { error: retryError } = await supabase
            .from('items')
            .update(updateDataWithoutActors)
            .eq('id', editingItem.id);
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      alert('Item actualizado exitosamente');
      setEditingItem(null);
      fetchItems();
    } catch (error) {
      alert('Error al actualizar: ' + error.message);
      console.error('Update error:', error);
    }
  };

  const generateItemCode = (index, title) => {
    const num = String(index + 1).padStart(3, '0');
    return `${num}-${title}`;
  };

  const getItemIndex = (itemId) => {
    return items.findIndex(item => item.id === itemId);
  };

  const exportItemToExcel = (item) => {
    const itemIndex = getItemIndex(item.id);
    const dataToExport = [{
      'Código': generateItemCode(itemIndex, item.title),
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
    }];

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, item.title.slice(0, 31));
    XLSX.writeFile(wb, `${item.title}.xlsx`);
  };

  const exportItemToCSV = (item) => {
    const itemIndex = getItemIndex(item.id);
    const etiqueta = generateItemCode(itemIndex, item.title);
    const csv = 'ETIQUETA\n' + etiqueta;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `etiquetas_${item.title}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const toggleItemSelection = (itemId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const exportSelectedToCSV = () => {
    if (selectedItems.size === 0) {
      alert('Selecciona al menos un item');
      return;
    }

    const itemsToExport = items.filter(item => selectedItems.has(item.id));
    let csv = 'ETIQUETA\n';
    
    itemsToExport.forEach((item, index) => {
      const itemIndex = items.findIndex(i => i.id === item.id);
      const etiqueta = generateItemCode(itemIndex, item.title);
      csv += etiqueta + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `etiquetas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setSelectedItems(new Set());
  };

  const selectAllFiltered = () => {
    const allIds = new Set(filteredItems.map(item => item.id));
    setSelectedItems(allIds);
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const getDashboardStats = () => {
    const totalLibros = items.filter(i => i.type === 'libro').length;
    const totalPeliculas = items.filter(i => i.type === 'película').length;
    
    const librosPorUbicacion = {};
    items.filter(i => i.type === 'libro').forEach(item => {
      const loc = item.location || 'Sin ubicar';
      librosPorUbicacion[loc] = (librosPorUbicacion[loc] || 0) + 1;
    });

    const categorias = {};
    items.forEach(item => {
      const cat = item.category || 'Sin categoría';
      categorias[cat] = (categorias[cat] || 0) + 1;
    });

    const peliculasPorFormato = {};
    items.filter(i => i.type === 'película').forEach(item => {
      const fmt = item.format || 'Desconocido';
      peliculasPorFormato[fmt] = (peliculasPorFormato[fmt] || 0) + 1;
    });

    return {
      totalLibros,
      totalPeliculas,
      totalItems: items.length,
      librosPorUbicacion,
      categorias,
      peliculasPorFormato
    };
  };

  const getCategories = () => {
    const categories = new Set(items.filter(i => i.category).map(i => i.category));
    return Array.from(categories).sort();
  };

  const fetchWatchlist = useCallback(async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching watchlist:', error);
    } else {
      setWatchlist(data || []);
    }
  }, [user?.id]);

  const addToWatchlist = async (e) => {
    e.preventDefault();
    if (!watchlistTitle.trim()) {
      alert('Ingresa el título de la película');
      return;
    }

    setSearching(true);
    const movieData = await searchMovieTmdbForWatchlist(watchlistTitle);

    const { error } = await supabase
      .from('watchlist')
      .insert([{
        user_id: user.id,
        title: watchlistTitle,
        format: watchlistFormat,
        poster_path: movieData.poster_path,
        rating: movieData.rating,
        synopsis: movieData.synopsis,
        watched: false
      }]);

    if (error) {
      console.error('Error adding to watchlist:', error);
      alert('Error al agregar a la lista');
    } else {
      setWatchlistTitle('');
      setSearching(false);
      fetchWatchlist();
    }
  };

  const removeFromWatchlist = async (id) => {
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting:', error);
    } else {
      fetchWatchlist();
    }
  };

  const toggleWatched = async (id, watched) => {
    const { error } = await supabase
      .from('watchlist')
      .update({ watched: !watched })
      .eq('id', id);

    if (error) {
      console.error('Error updating:', error);
    } else {
      fetchWatchlist();
    }
  };

  const searchMovieTmdbForWatchlist = async (title) => {
    try {
      const { data } = await axios.get(
        `https://api.themoviedb.org/3/search/movie?api_key=7f314794a2f3e443f9a8952fec2d31b3&query=${encodeURIComponent(title)}&language=es-MX`
      );
      
      if (data.results && data.results.length > 0) {
        const movie = data.results[0];
        return {
          tmdb_id: movie.id,
          poster_path: movie.poster_path ? `https://image.tmdb.org/t/p/w300${movie.poster_path}` : null,
          rating: movie.vote_average || 0,
          synopsis: movie.overview || ''
        };
      }
    } catch (error) {
      console.error('TMDb search error:', error);
    }
    return { poster_path: null, rating: 0, synopsis: '' };
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
          <button onClick={() => setShowDashboard(!showDashboard)} className="export-btn" title="Dashboard">
            📊
          </button>
          <button onClick={() => setShowWatchlist(!showWatchlist)} className="export-btn" title="Watchlist">
            🎬
          </button>
          <button onClick={() => setShowAddForm(true)} className="add-btn" title="Agregar nuevo item">
            +
          </button>
          <button onClick={exportToExcel} className="export-btn">📈</button>
          {selectedItems.size > 0 && (
            <>
              <button onClick={exportSelectedToCSV} className="export-btn" title={`Descargar ${selectedItems.size} etiqueta(s)`}>
                🏷️ {selectedItems.size}
              </button>
              <button onClick={clearSelection} className="export-btn" title="Limpiar selección">
                ✕
              </button>
            </>
          )}
          {filteredItems.length > 0 && selectedItems.size !== filteredItems.length && (
            <button onClick={selectAllFiltered} className="export-btn" title="Seleccionar todos">
              ☑️
            </button>
          )}
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
          {showDashboard ? (
            <div className="dashboard-container">
              <h2>📊 Dashboard de Biblioteca</h2>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number">{getDashboardStats().totalItems}</div>
                  <div className="stat-label">Total de Items</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{getDashboardStats().totalLibros}</div>
                  <div className="stat-label">📚 Libros</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{getDashboardStats().totalPeliculas}</div>
                  <div className="stat-label">🎬 Películas</div>
                </div>
              </div>

              <div className="dashboard-row">
                <div className="dashboard-section">
                  <h3>📍 Libros por Ubicación</h3>
                  <div className="stats-list">
                    {Object.entries(getDashboardStats().librosPorUbicacion)
                      .sort((a, b) => b[1] - a[1])
                      .map(([loc, count]) => (
                        <div key={loc} className="stat-item">
                          <span className="stat-name">{loc}</span>
                          <span className="stat-badge">{count}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>

                <div className="dashboard-section">
                  <h3>🏷️ Categorías</h3>
                  <div className="stats-list">
                    {Object.entries(getDashboardStats().categorias)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, count]) => (
                        <div key={cat} className="stat-item">
                          <span className="stat-name">{cat}</span>
                          <span className="stat-badge">{count}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>

                <div className="dashboard-section">
                  <h3>💿 Películas por Formato</h3>
                  <div className="stats-list">
                    {Object.entries(getDashboardStats().peliculasPorFormato)
                      .sort((a, b) => b[1] - a[1])
                      .map(([fmt, count]) => (
                        <div key={fmt} className="stat-item">
                          <span className="stat-name">{fmt}</span>
                          <span className="stat-badge">{count}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            </div>
          ) : showWatchlist ? (
            <div className="watchlist-container">
              <h2>🎬 Mi Watchlist</h2>
              <p className="watchlist-subtitle">Películas que quiero ver</p>

              <form onSubmit={addToWatchlist} className="watchlist-form">
                <input
                  type="text"
                  placeholder="Título de la película"
                  value={watchlistTitle}
                  onChange={(e) => setWatchlistTitle(e.target.value)}
                  className="watchlist-input"
                />
                <select
                  value={watchlistFormat}
                  onChange={(e) => setWatchlistFormat(e.target.value)}
                  className="watchlist-select"
                >
                  <option value="cine">🎟️ Cine</option>
                  <option value="streaming">📺 Streaming</option>
                  <option value="dvd">💿 DVD</option>
                  <option value="bluray">🎬 Blu-ray</option>
                </select>
                <button type="submit" className="watchlist-add-btn">Agregar</button>
              </form>

              <div className="watchlist-tabs">
                <span className="watchlist-tab-label">Por ver: {watchlist.filter(w => !w.watched).length}</span>
                <span className="watchlist-tab-label">Vistas: {watchlist.filter(w => w.watched).length}</span>
              </div>

              <div className="watchlist-items">
                {watchlist.length > 0 ? (
                  watchlist.map(item => (
                    <div key={item.id} className={`watchlist-item ${item.watched ? 'watched' : ''}`}>
                      <input
                        type="checkbox"
                        checked={item.watched}
                        onChange={() => toggleWatched(item.id, item.watched)}
                        className="watchlist-checkbox"
                      />
                      
                      <div className="watchlist-poster">
                        {item.poster_path ? (
                          <img src={item.poster_path} alt={item.title} />
                        ) : (
                          <div className="no-poster-watchlist">🎬</div>
                        )}
                      </div>

                      <div className="watchlist-info">
                        <h4>{item.title}</h4>
                        <div className="watchlist-meta">
                          <span className="watchlist-format">{
                            item.format === 'cine' ? '🎟️ Cine' :
                            item.format === 'streaming' ? '📺 Streaming' :
                            item.format === 'dvd' ? '💿 DVD' :
                            '🎬 Blu-ray'
                          }</span>
                          {item.rating > 0 && (
                            <span className="watchlist-rating">⭐ {item.rating.toFixed(1)}</span>
                          )}
                        </div>
                        {item.synopsis && (
                          <p className="watchlist-synopsis">{item.synopsis}</p>
                        )}
                      </div>

                      <button
                        onClick={() => removeFromWatchlist(item.id)}
                        className="watchlist-delete"
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    Tu watchlist está vacía. ¡Agrega películas que quieras ver!
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
          <div className="toolbar">
            <div className="toolbar-left">
              <span className="result-count">{filteredItems.length} items</span>
            </div>
            <div className="toolbar-right">
              <label className="size-label">Tamaño:</label>
              <input
                type="range"
                min="100"
                max="280"
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
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleItemSelection(item.id);
                      }}
                      className="item-checkbox"
                    />
                    <div className="poster">
                      {item.cover_url ? (
                        <img src={item.cover_url} alt={item.title} />
                      ) : (
                        <div className="no-poster">
                          {item.type === 'libro' ? '📚' : '🎬'}
                        </div>
                      )}
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
            </>
          )}
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

              <button
                className="edit-btn-detail"
                onClick={() => setEditingItem({ ...selectedItem })}
              >
                ✏️ Editar
              </button>

              <div className="export-menu">
                <button className="export-menu-btn" title="Exportar">
                  📥 Descargar
                </button>
                <div className="export-options">
                  <button
                    className="export-option"
                    onClick={() => exportItemToExcel(selectedItem)}
                  >
                    📊 Excel
                  </button>
                  <button
                    className="export-option"
                    onClick={() => exportItemToCSV(selectedItem)}
                  >
                    🏷️ Etiquetas CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditingItem(null)}>×</button>
            
            <h2>Editar {editingItem.type === 'libro' ? 'Libro' : 'Película'}</h2>

            <form onSubmit={updateItem} className="add-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Título *</label>
                  <input
                    type="text"
                    value={editingItem.title}
                    onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Año</label>
                  <input
                    type="number"
                    value={editingItem.year || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, year: e.target.value })}
                  />
                </div>
              </div>

              {editingItem.type === 'libro' ? (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Autor</label>
                      <input
                        type="text"
                        value={editingItem.author || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, author: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Editorial</label>
                      <input
                        type="text"
                        value={editingItem.publisher || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, publisher: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>ISBN</label>
                      <input
                        type="text"
                        value={editingItem.isbn || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, isbn: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Páginas</label>
                      <input
                        type="number"
                        value={editingItem.pages || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, pages: e.target.value })}
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
                        value={editingItem.director || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, director: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Rating (0-10)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={editingItem.rating || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, rating: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Actores</label>
                    <input
                      type="text"
                      value={editingItem.actors || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, actors: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Duración (min)</label>
                    <input
                      type="number"
                      value={editingItem.duration || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, duration: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Categoría</label>
                  <input
                    type="text"
                    value={editingItem.category || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Condición</label>
                  <select
                    value={editingItem.condition}
                    onChange={(e) => setEditingItem({ ...editingItem, condition: e.target.value })}
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
                  value={editingItem.location || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, location: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Portada (Imagen)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setEditingItem({ ...editingItem, cover_url: event.target?.result });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>

              <div className="form-group">
                <label>Sinopsis / Notas</label>
                <textarea
                  value={editingItem.synopsis || editingItem.notes || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, synopsis: e.target.value, notes: e.target.value })}
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="save-btn">Guardar Cambios</button>
                <button type="button" className="cancel-btn" onClick={() => setEditingItem(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    <label>Buscar libro por ISBN o Título (Presiona Enter)</label>
                    <input
                      type="text"
                      placeholder="Escanea ISBN o escribe el título"
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
                <label>Portada (Imagen)</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setFormData({ ...formData, cover_url: event.target?.result });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <button type="button" onClick={handleCameraCapture} style={{ padding: '8px 12px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    📷 Cámara
                  </button>
                </div>
                {formData.cover_url && <img src={formData.cover_url} alt="Preview" style={{ maxWidth: '120px', marginTop: '10px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />}
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
