// ── Global State Store ────────────────────────────
const Store = (() => {
  let _state = {
    user: null,
    token: null,
    listings: [],
    currentListing: null,
  };

  const _listeners = [];

  function getState() { return { ..._state }; }

  function setState(partial) {
    _state = { ..._state, ...partial };
    _listeners.forEach(fn => fn(_state));
  }

  function subscribe(fn) {
    _listeners.push(fn);
    return () => { const i = _listeners.indexOf(fn); if (i > -1) _listeners.splice(i, 1); };
  }

  // Persistenz via localStorage
  function persist() {
    if (_state.token) {
      localStorage.setItem('cb_token', _state.token);
      localStorage.setItem('cb_user', JSON.stringify(_state.user));
    } else {
      localStorage.removeItem('cb_token');
      localStorage.removeItem('cb_user');
    }
  }

  function loadFromStorage() {
    const token = localStorage.getItem('cb_token');
    const user = localStorage.getItem('cb_user');
    if (token && user) {
      _state.token = token;
      _state.user = JSON.parse(user);
    }
  }

  function logout() {
    setState({ user: null, token: null });
    persist();
  }

  loadFromStorage();
  return { getState, setState, subscribe, persist, logout };
})();
