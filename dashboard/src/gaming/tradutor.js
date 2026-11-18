// Browser translators (Edge, Chrome/Google Translate, extensions) replace the
// text nodes React rendered with their own <font> elements. When React later
// updates or removes one of its original nodes (the upload %, a status line),
// the DOM call throws "Failed to execute 'insertBefore'/'removeChild' on
// 'Node'" and the whole panel went down mid-upload. The page now asks not to
// be translated (index.html); this is the fallback for a forced translation:
// skip the impossible DOM move instead of crashing (the widely used workaround
// from facebook/react#11538). Text may stay stale until the next reload.
if (typeof Node === 'function' && Node.prototype) {
  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) {
      if (typeof console !== 'undefined') console.warn('Tradutor do navegador alterou a página: remoção ignorada.');
      return child;
    }
    return removeChild.apply(this, arguments);
  };
  const insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== 'undefined') console.warn('Tradutor do navegador alterou a página: inserção ignorada.');
      return newNode;
    }
    return insertBefore.apply(this, arguments);
  };
}
