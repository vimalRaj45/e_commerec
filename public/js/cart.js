const Cart = {
  items: [],

  async fetch() {
    try {
      const res = await API.get('/cart');
      this.items = res.data;
      this.updateBadge();
      return this.items;
    } catch (err) {
      console.error('Failed to fetch cart:', err);
      return [];
    }
  },

  async add(productId, quantity = 1) {
    try {
      await API.post('/cart/add', { productId, quantity });
      await this.fetch();
      utils.showToast('Added to cart', 'success');
    } catch (err) {
      utils.showToast(err.message, 'error');
    }
  },

  async update(productId, quantity) {
    try {
      await API.put('/cart/update', { productId, quantity });
      await this.fetch();
    } catch (err) {
      utils.showToast(err.message, 'error');
    }
  },

  async remove(productId) {
    try {
      await API.delete(`/cart/remove/${productId}`);
      await this.fetch();
    } catch (err) {
      utils.showToast(err.message, 'error');
    }
  },

  async clear() {
    try {
      await API.delete('/cart/clear');
      this.items = [];
      this.updateBadge();
    } catch (err) {
      console.error('Failed to clear cart:', err);
    }
  },

  updateBadge() {
    const badges = document.querySelectorAll('.cart-badge');
    const count = this.items.reduce((sum, item) => sum + item.quantity, 0);
    badges.forEach(badge => {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    });
  }
};

// Initialize cart on load
document.addEventListener('DOMContentLoaded', () => Cart.fetch());
