// Modules that need to run cleanup logic when a specific modal closes (e.g. the
// comments module unsubscribing its Firestore listener) register a callback here
// instead of the previous approach of monkey-patching window.closeModal.
const closeCallbacks = {};

export function onModalClose(id, fn) {
  closeCallbacks[id] = fn;
}

export function openModal(id) {
  document.getElementById(id).classList.add('open');
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (closeCallbacks[id]) closeCallbacks[id]();
}

export function handleOvClick(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}
