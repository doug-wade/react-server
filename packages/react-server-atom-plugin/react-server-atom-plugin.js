'use babel';

import ReactServerAtomPluginView from './react-server-atom-plugin-view';
import { CompositeDisposable } from 'atom';
import cli from 'react-server-cli';

export default {

  reactServerAtomPluginView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    console.log('starting server...');
    // TODO: once https://github.com/redfin/react-server/issues/241 is fixed,
    // start only the page that is in the open buffer.
    cli.start();
    state.reactServerAtomPluginViewState.cwd = process.cwd();
    this.reactServerAtomPluginView = new ReactServerAtomPluginView(state.reactServerAtomPluginViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.reactServerAtomPluginView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'react-server-atom-plugin:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.reactServerAtomPluginView.destroy();
  },

  serialize() {
    return {
      reactServerAtomPluginViewState: this.reactServerAtomPluginView.serialize()
    };
  },

  toggle() {
    console.log('ReactServerAtomPlugin was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

};
