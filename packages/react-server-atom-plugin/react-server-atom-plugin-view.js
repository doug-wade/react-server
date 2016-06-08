'use babel';

export default class ReactServerAtomPluginView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('react-server-atom-plugin');

    // Create message element
    const message = document.createElement('div');
    message.textContent = `react-server-cli started in directory ${serializedState.cwd}`;
    message.classList.add('message');
    this.element.appendChild(message);
    message.onclick = () => {
      console.log('closing message');
      message.parentNode.removeChild(message);
    };
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

}
