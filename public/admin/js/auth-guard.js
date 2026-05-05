(function() {
    const token = localStorage.getItem('admin_token');
    if (!token && !window.location.pathname.endsWith('login.html')) {
        window.location.href = '/admin/login.html';
    }
})();

async function logout() {
    try {
        await API.post('/auth/logout');
    } catch (err) {}
    localStorage.removeItem('admin_token');
    window.location.href = '/admin/login.html';
}
