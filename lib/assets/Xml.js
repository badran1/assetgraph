const JSDOM = require('jsdom').JSDOM;
const Text = require('./Text');

class Xml extends Text {
  get parseTree() {
    if (!this._parseTree) {
      const text = this.text;
      const matchXmlDeclaration = text.match(/^<\?[^?>]*?\?>\s*/);
      if (matchXmlDeclaration) {
        this.xmlDeclaration = matchXmlDeclaration[0];
      } else {
        this.xmlDeclaration = '';
      }
      try {
        this._jsdom = this._initJsdom(text);
      } catch (err) {
        err.asset = this;
        if (this.assetGraph) {
          this.assetGraph.warn(err);
        } else {
          throw err;
        }
        this._jsdom = new JSDOM('<?xml version="1.0"?><root/>', {
          url: this.url ? this.url : undefined, // So that errors get reported with the url (awaiting https://github.com/jsdom/jsdom/pull/2630)
          contentType: 'application/xhtml+xml'
        });
      }
      this._parseTree = this._jsdom.window.document;
    }
    return this._parseTree;
  }

  _initJsdom(text) {
    return new JSDOM(text, {
      url: this.url ? this.url : undefined, // So that errors get reported with the url (awaiting https://github.com/jsdom/jsdom/pull/2630)
      contentType: 'application/xhtml+xml'
    });
  }

  _serializeJsdom(jsdom) {
    return `${this.xmlDeclaration}${jsdom.serialize()}`;
  }

  set parseTree(parseTree) {
    this.unload();
    this._parseTree = parseTree;
    this._lastKnownByteLength = undefined;
    if (this.assetGraph) {
      this.populate();
    }
    this.markDirty();
  }

  get text() {
    if (typeof this._text !== 'string') {
      if (this._parseTree) {
        this._text = this._serializeJsdom(this._jsdom);
      } else {
        this._text = this._getTextFromRawSrc();
      }
    }
    return this._text;
  }

  set text(text) {
    super.text = text;
  }

  unload() {
    super.unload();
    if (this._jsdom) {
      this._jsdom.window.close();
      this._jsdom = undefined;
    }
  }

  *_visitAllNodesInDom(node = this.parseTree) {
    const stopTraversal = yield node;
    if (!stopTraversal && node.childNodes) {
      for (const childNode of Array.from(node.childNodes)) {
        yield* this._visitAllNodesInDom(childNode);
      }
    }
  }

  findOutgoingRelationsInParseTree() {
    const outgoingRelations = super.findOutgoingRelationsInParseTree();
    if (!this.isLoaded) {
      return outgoingRelations;
    }
    const nodeGenerator = this._visitAllNodesInDom();
    let stopTraversal = false;
    while (true) {
      const { done, value: node } = nodeGenerator.next(stopTraversal);
      if (done) {
        break;
      }
      stopTraversal = false;
      for (const Relation of Xml.relations) {
        if (Relation.getRelationsFromNode) {
          let relations = Relation.getRelationsFromNode(node, this);
          if (Relation.stopTraversal && Relation.stopTraversal(node, this)) {
            stopTraversal = true;
          }
          if (relations) {
            if (!Array.isArray(relations)) {
              relations = [relations];
            }
            for (const relation of relations) {
              relation.type = relation.type || Relation.name;
            }
            outgoingRelations.push(...relations);
          }
        }
      }
    }
    return outgoingRelations;
  }

  minify() {
    for (const node of this._visitAllNodesInDom()) {
      if (
        node.nodeType === node.TEXT_NODE &&
        /^[\r\n\s\t]*$/.test(node.nodeValue)
      ) {
        node.parentNode.removeChild(node);
      }
    }
    this.markDirty();
    this.isPretty = false;
    return this;
  }

  prettyPrint() {
    this.isPretty = true;
    // eslint-disable-next-line no-unused-expressions
    this.parseTree; // So markDirty removes this._text
    this.markDirty();
    return this;
  }
}

Object.assign(Xml.prototype, {
  contentType: 'text/xml',

  supportedExtensions: ['.xml'],

  isPretty: false
});

module.exports = Xml;
