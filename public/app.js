const ctaStart = document.getElementById('ctaStart');
const ctaFooter = document.getElementById('ctaFooter');

const scrollToPlans = () => {
  const target = document.querySelector('#plans');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

if (ctaStart) {
  ctaStart.addEventListener('click');
}

if (ctaFooter) {
  ctaFooter.addEventListener('click', scrollToPlans);
}

const highlightCards = document.querySelectorAll('.feature-card');
highlightCards.forEach((card) => {
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-10px)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
});
