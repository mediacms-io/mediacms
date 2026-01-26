/* Wait until at least N nav-menu elements exist */
const waitForNavMenus = async (count = 1) => {
  while (document.querySelectorAll('.nav-menu').length < count) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  return document.querySelectorAll('.nav-menu');
};

/* Helper to add a sidebar menu item to a specific nav-menu */
function addMenuItem({
  menuIndex,   // which .nav-menu (0-based)
  href,
  title,
  label,
  iconName,
  index        // position inside that menu's <ul> (0-based)
}) {
  const menus = document.querySelectorAll('.nav-menu');
  const menu = menus[menuIndex];
  if (!menu) return;

  const ul = menu.querySelector('nav ul');
  if (!ul) return;

  // Prevent duplicates (global)
  if (document.querySelector(`a[href="${href}"]`)) return;

  const a = document.createElement('a');
  a.href = href;
  a.title = title;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'menu-item-icon';

  const icon = document.createElement('i');
  icon.className = 'material-icons';
  icon.setAttribute('data-icon', iconName);

  iconSpan.appendChild(icon);
  a.appendChild(iconSpan);

  const textSpan = document.createElement('span');
  textSpan.textContent = label;
  a.appendChild(textSpan);

  const li = document.createElement('li');
  li.className = 'link-item';

  if (window.location.pathname.startsWith(href)) {
    li.classList.add('active');
  }

  li.appendChild(a);

  if (ul.children.length > index) {
    ul.insertBefore(li, ul.children[index]);
  } else {
    ul.appendChild(li);
  }
}

/* Inject items once sidebar is fully present */
waitForNavMenus(2).then(() => {

  // FIRST nav-menu (main navigation)
  addMenuItem({
    menuIndex: 0,
    href: '/advanced_search',
    title: 'Advanced Tags',
    label: 'Advanced Tags',
    iconName: 'search',
    index: 5
  });

  // SECOND nav-menu (user section)
  addMenuItem({
    menuIndex: 1,
    href: '/uploader/import-from-metadata',
    title: 'Bulk Import',
    label: 'Bulk Import',
    iconName: 'cloud_upload',
    index: 1
  });

});

