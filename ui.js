export function openV2AsPage(sectionId) {
  document.body.classList.add('v2-mode');
  const mainCard = document.querySelector('.card');
  if (mainCard) mainCard.style.display = 'none';

  ['v2-pagina-negado', 'v2-pagina-aprovado'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('v2-hidden');
    el.classList.remove('v2-flex');
  });

  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.remove('v2-fixed','v2-inset-0','v2-overflow-auto','v2-z-50');
    target.classList.remove('v2-hidden');

    target.classList.add('v2-flex','v2-items-center','v2-justify-center','v2-min-h-screen');
  }
}
