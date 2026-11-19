export function renderPage(view, activePage = view) {
  return (req, res) => res.render(view, {
    user: req.user ?? null,
    activePage
  });
}
