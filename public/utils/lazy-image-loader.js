// Lazy loading utility dla obrazów
export class LazyImageLoader {
  constructor() {
    this.imageObserver = null;
    this.init();
  }

  init() {
    if ('IntersectionObserver' in window) {
      this.imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            this.loadImage(img);
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px'
      });
    }
  }

  observe(img) {
    if (this.imageObserver) {
      this.imageObserver.observe(img);
    } else {
      // Fallback dla starszych przeglądarek
      this.loadImage(img);
    }
  }

  loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;

    // Dodaj placeholder podczas ładowania
    img.style.filter = 'blur(5px)';
    img.style.transition = 'filter 0.3s';

    const newImg = new Image();
    newImg.onload = () => {
      img.src = src;
      img.style.filter = 'none';
      img.classList.add('loaded');
    };
    
    newImg.onerror = () => {
      img.src = this.getPlaceholderUrl(img.alt || 'Player');
      img.style.filter = 'none';
      img.classList.add('error');
    };

    newImg.src = src;
  }

  getPlaceholderUrl(text) {
    const initials = text.split(' ').map(word => word[0]).join('').toUpperCase();
    return `https://via.placeholder.com/150x150/333/fff?text=${initials}`;
  }

  // Dodaj lazy loading do wszystkich obrazów z data-src
  observeAll(container = document) {
    const images = container.querySelectorAll('img[data-src]');
    images.forEach(img => this.observe(img));
  }
}

// Singleton instance
export const lazyLoader = new LazyImageLoader();