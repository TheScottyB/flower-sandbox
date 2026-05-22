// script.js - Dynamic behavior for FlowerSandbox landing website

document.addEventListener('DOMContentLoaded', () => {
  // Initialize floating background petals
  createBackgroundPetals();

  // Handle Contact/Support form submission
  const contactForm = document.getElementById('support-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const message = document.getElementById('contact-message').value.trim();
      
      if (!name || !email || !message) {
        alert('Please fill in all fields.');
        return;
      }
      
      // Simulate form submission
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending...';
      
      setTimeout(() => {
        // Hide form fields
        contactForm.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        
        // Show success alert
        const successAlert = document.getElementById('success-alert');
        if (successAlert) {
          successAlert.style.display = 'block';
          successAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 1500);
    });
  }

  // Interactivity: Spawn a floating petal on click
  document.addEventListener('click', (e) => {
    // Only spawn if clicking on interactive elements is not disrupted
    const target = e.target;
    if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }
    spawnPetalAt(e.clientX, e.clientY);
  });
});

/**
 * Generate randomly floating background petals
 */
function createBackgroundPetals() {
  const container = document.querySelector('.petals-container');
  if (!container) return;

  const count = 15;
  for (let i = 0; i < count; i++) {
    const delay = Math.random() * 12;
    const duration = 8 + Math.random() * 10;
    const left = Math.random() * 100;
    const size = 10 + Math.random() * 15;
    
    const petal = document.createElement('div');
    petal.classList.add('petal');
    petal.style.left = `${left}%`;
    petal.style.width = `${size}px`;
    petal.style.height = `${size * 1.3}px`;
    petal.style.animationDelay = `${delay}s`;
    petal.style.animationDuration = `${duration}s`;
    
    // Random rotation
    petal.style.transform = `rotate(${Math.random() * 360}deg)`;

    container.appendChild(petal);
  }
}

/**
 * Spawn a customized interactive floating petal at click coordinates
 */
function spawnPetalAt(x, y) {
  const container = document.querySelector('.petals-container');
  if (!container) return;

  const petal = document.createElement('div');
  petal.classList.add('petal');
  
  const size = 15 + Math.random() * 10;
  petal.style.left = `${x - size / 2}px`;
  petal.style.top = `${y - size / 2}px`;
  petal.style.position = 'absolute';
  petal.style.width = `${size}px`;
  petal.style.height = `${size * 1.3}px`;
  
  // Custom animation properties for manual spawn
  petal.style.animation = 'float-click-petal 2s cubic-bezier(0.1, 0.8, 0.3, 1) forwards';
  petal.style.opacity = '0.8';
  petal.style.transform = `rotate(${Math.random() * 360}deg)`;

  container.appendChild(petal);

  // Keyframes injector for dynamic clicks
  if (!document.getElementById('petal-click-keyframes')) {
    const style = document.createElement('style');
    style.id = 'petal-click-keyframes';
    style.innerHTML = `
      @keyframes float-click-petal {
        0% {
          transform: scale(0) rotate(0deg) translate(0, 0);
          opacity: 0.8;
        }
        100% {
          transform: scale(1) rotate(180deg) translate(${(Math.random() - 0.5) * 150}px, -150px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Remove petal from DOM once animation is complete
  setTimeout(() => {
    petal.remove();
  }, 2000);
}
