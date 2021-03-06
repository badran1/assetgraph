const unexpected = require('../unexpected-with-plugins');
const AssetGraph = require('../../lib/AssetGraph');
const mozilla = require('source-map');
const pathModule = require('path');

function createAsset(inputHtml) {
  return new AssetGraph().addAsset({
    type: 'Html',
    text: inputHtml
  });
}

describe('assets/Html', function() {
  const expect = unexpected
    .clone()
    .addAssertion('<string> to minify to <string> <function?>', function(
      expect,
      subject,
      value,
      manipulator
    ) {
      const htmlAsset = new AssetGraph().addAsset({
        type: 'Html',
        text: subject
      });
      if (manipulator) {
        manipulator(htmlAsset);
        htmlAsset.markDirty();
      }
      htmlAsset.minify();
      expect(htmlAsset.text, 'to equal', value);
    });

  it('should handle a test case with a javascript: url', async function() {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '../../testdata/assets/Html/javascriptUrl/'
      )
    });
    await assetGraph.loadAssets('index.html');
    await assetGraph.populate();

    expect(assetGraph, 'to contain assets', 2);
    expect(assetGraph, 'to contain asset', 'Html');
    expect(assetGraph, 'to contain relation', 'HtmlAnchor');
    expect(assetGraph, 'to contain asset', 'JavaScript');

    const javaScript = assetGraph.findAssets({
      type: 'JavaScript',
      isInline: true
    })[0];
    javaScript.parseTree.body.push({
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'alert' },
      arguments: [{ type: 'Literal', value: 'bar', raw: "'bar'" }]
    });
    javaScript.markDirty();

    expect(assetGraph.findAssets({ type: 'Html' })[0].text, 'to match', /bar/);
  });

  describe('#text', function() {
    it('should get text of asset instantiated with rawSrc property', function() {
      expect(
        new AssetGraph().addAsset({
          type: 'Html',
          rawSrc: Buffer.from(
            '<!DOCTYPE html><html><body>Hello, world!\u263a</body></html>'
          )
        }).text,
        'to equal',
        '<!DOCTYPE html><html><body>Hello, world!\u263a</body></html>'
      );
    });

    it('should get text of AssetGraph.Html instantiated with text property', function() {
      expect(
        new AssetGraph().addAsset({
          type: 'Html',
          text: '<!DOCTYPE html><html><body>Hello, world!\u263a</body></html>'
        }).text,
        'to equal',
        '<!DOCTYPE html><html><body>Hello, world!\u263a</body></html>'
      );
    });

    it('should get text of AssetGraph.Html instantiated with rawSrc property and modified parse tree', function() {
      const htmlAsset = new AssetGraph().addAsset({
        type: 'Html',
        rawSrc: Buffer.from(
          '<!DOCTYPE html><html><body>Hello, world!\u263a</body></html>'
        )
      });
      htmlAsset.parseTree.body.firstChild.nodeValue = 'Not so much!';
      htmlAsset.markDirty();
      expect(
        htmlAsset.text,
        'to equal',
        '<!DOCTYPE html><html><head></head><body>Not so much!</body></html>'
      );
    });

    it('should get text of AssetGraph.Html with text property and modified parse tree', function() {
      const htmlAsset = new AssetGraph().addAsset({
        type: 'Html',
        text: '<!DOCTYPE html><html><body>Hello, world!\u263a</body></html>'
      });
      htmlAsset.parseTree.body.firstChild.nodeValue = 'Not so much!';
      htmlAsset.markDirty();
      expect(
        htmlAsset.text,
        'to equal',
        '<!DOCTYPE html><html><head></head><body>Not so much!</body></html>'
      );
    });
  });

  describe('#rawSrc', function() {
    it('should get rawSrc of AssetGraph.Html with rawSrc property', function() {
      expect(
        new AssetGraph().addAsset({
          type: 'Html',
          rawSrc: Buffer.from(
            '<!DOCTYPE html><html><head></head><body>Hello, world!\u263a</body></html>'
          )
        }).rawSrc,
        'to equal',
        Buffer.from(
          '<!DOCTYPE html><html><head></head><body>Hello, world!\u263a</body></html>',
          'utf-8'
        )
      );
    });

    it('should get rawSrc of AssetGraph.Html instantiated with text property', function() {
      expect(
        new AssetGraph().addAsset({
          type: 'Html',
          text:
            '<!DOCTYPE html><html><head></head><body>Hello, world!\u263a</body></html>'
        }).rawSrc,
        'to equal',
        Buffer.from(
          '<!DOCTYPE html><html><head></head><body>Hello, world!\u263a</body></html>',
          'utf-8'
        )
      );
    });

    it('should get rawSrc of AssetGraph.Html with rawSrc property and modified parse tree', function() {
      const htmlAsset = new AssetGraph().addAsset({
        type: 'Html',
        rawSrc: Buffer.from(
          '<!DOCTYPE html><html><head></head><body>Hello, world!\u263a</body></html>'
        )
      });
      htmlAsset.parseTree.body.firstChild.nodeValue = 'Not so much!';
      htmlAsset.markDirty();
      expect(
        htmlAsset.rawSrc,
        'to equal',
        Buffer.from(
          '<!DOCTYPE html><html><head></head><body>Not so much!</body></html>',
          'utf-8'
        )
      );
    });

    it('should get rawSrc of AssetGraph.Html with text property and modified parse tree', function() {
      const htmlAsset = new AssetGraph().addAsset({
        type: 'Html',
        text: '<!DOCTYPE html><html><body>Hello, world!\u263a</body></html>'
      });
      htmlAsset.parseTree.body.firstChild.nodeValue = 'Not so much!';
      htmlAsset.markDirty();
      expect(
        htmlAsset.rawSrc,
        'to equal',
        Buffer.from(
          '<!DOCTYPE html><html><head></head><body>Not so much!</body></html>',
          'utf-8'
        )
      );
    });
  });

  describe('#unload', function() {
    it('should not break when the asset is not loaded', function() {
      const assetGraph = new AssetGraph();
      const htmlAsset = assetGraph.addAsset({
        type: 'Html',
        url: 'https://example.com/'
      });

      htmlAsset.unload();
    });
  });

  describe('#findOutgoingRelationsInParseTree', function() {
    it('should add Css type to HtmlStyle relation targets that have no .css file extension', async function() {
      const assetGraph = new AssetGraph({
        root: pathModule.resolve(
          __dirname,
          '../../testdata/assets/Html/cssWithoutExtension/'
        )
      });
      await assetGraph.loadAssets('index.html').populate();

      const htmlAsset = assetGraph.findAssets({ type: 'Html' })[0];

      expect(htmlAsset.outgoingRelations[0].to, 'to satisfy', { type: 'Css' });
    });
  });

  describe('template escaping', function() {
    it('should handle a non-templated HTML asset', function() {
      const asset = createAsset('<div></div>');
      // eslint-disable-next-line no-unused-expressions
      asset.parseTree; // Side effect: Populate asset._templateReplacement
      expect(asset.text, 'to equal', '<div></div>');
      expect(asset._templateReplacements, 'to equal', {});
      asset.markDirty();
      expect(asset.text, 'to equal', '<div></div>');
    });

    it('should handle an underscore template', function() {
      const asset = createAsset('<div><% foo %></div>');

      // eslint-disable-next-line no-unused-expressions
      asset.parseTree; // Side effect: Populate asset._templateReplacement
      expect(asset._templateReplacements, 'to equal', { '⋖5⋗': '<% foo %>' });
      expect(asset.text, 'to equal', '<div><% foo %></div>');

      asset.parseTree.firstChild.removeChild(
        asset.parseTree.firstChild.firstChild
      );
      asset.markDirty();
      expect(asset.text, 'to equal', '<div></div>');

      asset.text = '<div><% bar %></div>';
      // eslint-disable-next-line no-unused-expressions
      asset.parseTree; // Side effect: Populate asset._templateReplacement
      expect(
        asset.parseTree.firstChild.firstChild.nodeValue,
        'to equal',
        '⋖5⋗'
      );

      expect(asset._templateReplacements, 'to equal', { '⋖5⋗': '<% bar %>' });
      expect(asset.text, 'to equal', '<div><% bar %></div>');
    });

    it('should handle the PHP template syntax', function() {
      const asset = createAsset('<div><? foo ?></div>');
      expect(asset.text, 'to equal', '<div><? foo ?></div>');
      // eslint-disable-next-line no-unused-expressions
      asset.parseTree; // Side effect: Populate asset._templateReplacement
      expect(
        asset.parseTree.firstChild.firstChild.nodeValue,
        'to equal',
        '⋖5⋗'
      );

      expect(asset._templateReplacements['⋖5⋗'], 'to equal', '<? foo ?>');
      expect(asset.text, 'to equal', '<div><? foo ?></div>');
      asset.markDirty();
      expect(asset.text, 'to equal', '<div><? foo ?></div>');

      asset.text = '<div><? bar ?></div>';
      expect(asset.text, 'to equal', '<div><? bar ?></div>');
      // eslint-disable-next-line no-unused-expressions
      asset.parseTree;
      asset.markDirty(); // Side effect: Populate asset._templateReplacement
      expect(asset.text, 'to equal', '<div><? bar ?></div>');
    });

    it('should handle a an underscore template with a PHP close tag inside the dynamic part', function() {
      const asset = createAsset('<div><% foo ?> %></div>');

      // eslint-disable-next-line no-unused-expressions
      asset.parseTree; // Side effect: Populate asset._templateReplacement
      expect(
        asset.parseTree.firstChild.firstChild.nodeValue,
        'to equal',
        '⋖5⋗'
      );

      expect(asset.text, 'to equal', '<div><% foo ?> %></div>');
      asset.markDirty();
      expect(asset.text, 'to equal', '<div><% foo ?> %></div>');
    });
  });

  describe('#isFragment', function() {
    describe('when the source has not been parsed yet', function() {
      it('should be true when the source has no <html>, <head>, or <body>', function() {
        expect(createAsset('<div>foo</div>').isFragment, 'to be true');
      });

      it('should be false when the source contains <html>', function() {
        expect(createAsset('<html>').isFragment, 'to be false');
      });

      it('should be false when the source contains <head>', function() {
        expect(createAsset('<head>').isFragment, 'to be false');
      });

      it('should be false when the source contains <body>', function() {
        expect(createAsset('<body>').isFragment, 'to be false');
      });

      it('should be false when the source contains a doctype', function() {
        expect(createAsset('<!doctype html>').isFragment, 'to be false');
      });
    });
  });

  describe('#minify()', function() {
    it('should leave <pre> alone', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><pre>  foo bar  </pre></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><pre>  foo bar  </pre></body></html>'
      );
    });

    it('should strip a random, non-whitelisted HTML comment', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><!--bogus--></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body></body></html>'
      );
    });

    it('should leave SSI comment alone', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><!--#echo "foo"--></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><!--#echo "foo"--></body></html>'
      );
    });

    it('should preserve Knockout containerless binding comment', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><!-- ko foreach: blah --><div></div><!--/ko --></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><!-- ko foreach: blah --><div></div><!--/ko --></body></html>'
      );
    });

    it('should preserve an already minified Knockout containerless binding comment', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><!--ko foreach: blah--><div></div><!--/ko--></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><!--ko foreach: blah--><div></div><!--/ko--></body></html>'
      );
    });

    it('should preserve Htmlizer containerless binding comment', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><!-- hz foreach: blah --><div></div><!--/hz --></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><!-- hz foreach: blah --><div></div><!--/hz --></body></html>'
      );
    });

    it('should remove leading whitespace in the first text node child of a block-level element', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><div>   blah</div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><div>blah</div></body></html>'
      );
    });

    it('should remove leading whitespace in the first text node child of a block-level element with comment in the middle', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><div> <!--foo-->  blah</div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><div>blah</div></body></html>'
      );
    });

    it('should remove different types of leading whitespace in the first text node child of a block-level element', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><div>\t   \nblah</div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><div>blah</div></body></html>'
      );
    });

    it('should remove trailing whitespace in the last text node child of a block-level element', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><div>blah   </div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><div>blah</div></body></html>'
      );
    });

    it('should remove trailing whitespace in the last text node child of a block-level element with comment in the middle', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><div>blah <!--foo-->  </div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><div>blah</div></body></html>'
      );
    });

    it('should remove different types of trailing whitespace in last text node child of a block-level element', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><div>blah   \n\t</div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><div>blah</div></body></html>'
      );
    });

    it('should compress sequences of more than one whitespace char in text nodes', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><div>blah   blah</div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><div>blah blah</div></body></html>'
      );
    });

    it('should compress sequences of different types of whitespace char in text nodes', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><div>blah \n\t  blah</div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><div>blah blah</div></body></html>'
      );
    });

    it('should remove an all-whitespace text node', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><div>   </div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><div></div></body></html>'
      );
    });

    it('should remove an all-whitespace text node between block-level elements', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body>    <div></div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><div></div></body></html>'
      );
    });

    it('should remove leading and trailing whitespace between block-level', function() {
      expect(
        '<!DOCTYPE html><html>   <head> \r\n   </head> \n\n <body>    <div>    </div>    </body>    </html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><div></div></body></html>'
      );
    });

    it('should leave a text node consisting of a single non-breaking space alone', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body>&nbsp;<div></div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body>&nbsp;<div></div></body></html>'
      );
    });

    it('should compress whitespace before and after <span data-i18n="..."> should be compressed down to one', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body>  Here is the thing:  <span data-i18n="blah">foo</span>  and furthermore...  </body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body>Here is the thing: <span data-i18n=blah>foo</span> and furthermore...</body></html>'
      );
    });

    it('should keep one leading/trailing space in text nodes below elements with data-i18n', function() {
      expect(
        '<div><span data-i18n="ShowingXToYOfZ">\n    <span>1</span>\n     -                <span>50</span>\nof                      <span>0</span>\n            </span>\n</div>',
        'to minify to',
        '<div><span data-i18n=ShowingXToYOfZ><span>1</span> - <span>50</span> of <span>0</span></span></div>'
      );
    });

    it('should treat non-breaking space as a regular character when compressing whitespace', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body> &nbsp;  &nbsp; <div></div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body>&nbsp; &nbsp;<div></div></body></html>'
      );
    });

    it('should handle neighbour text nodes adding up to a sequence of more than one whitespace char', function() {
      expect(
        '<!DOCTYPE html><html><head></head><body><div>foo  </div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body><div>foo bar</div></body></html>',
        htmlAsset => {
          const document = htmlAsset.parseTree;
          document
            .getElementsByTagName('div')[0]
            .appendChild(document.createTextNode('  bar'));
        }
      );

      expect(
        '<!DOCTYPE html><html><head></head><body><div></div><div></div></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body>bar bar bar bar bar<div></div><div></div></body></html>',
        htmlAsset => {
          const document = htmlAsset.parseTree;
          const firstDiv = document.getElementsByTagName('div')[0];
          for (let i = 0; i < 5; i += 1) {
            firstDiv.parentNode.insertBefore(
              document.createTextNode('  bar  '),
              firstDiv
            );
          }
        }
      );
    });

    it('should trim leading whitespace in an inline element followed by a text node with leading whitespace', function() {
      expect(
        '<div><span>foo </span> bar</div>',
        'to minify to',
        '<div><span>foo </span>bar</div>'
      );
    });

    it('should trim trailing whitespace in inline tag followed by leading whitespace in the next sibling', function() {
      expect(
        '<div><span>foo </span><span> bar</span></div>',
        'to minify to',
        '<div><span>foo </span><span>bar</span></div>' // I'm actually not sure that this one is perfectly safe
      );
    });

    it('should trim trailing whitespace in inline tag followed by leading whitespace in the child node of the next sibling', function() {
      expect(
        '<div><span>foo </span><span><span> bar</span></span></div>',
        'to minify to',
        '<div><span>foo </span><span><span>bar</span></span></div>' // I'm actually not sure that this one is perfectly safe
      );
    });

    it('should preserve whitespace inside anchor', function() {
      expect(
        '<ul>\n    <li>\n        <a><i></i> Bar</a>\n    </li>\n</ul>',
        'to minify to',
        '<ul><li><a><i></i> Bar</a></li></ul>'
      );
    });

    it('should preserve hair space', function() {
      expect('<p>hair space</p>', 'to minify to', '<p>hair space</p>');
    });

    it('should preserve hair space encoded as a HTML entity', function() {
      expect('<p>hair&#8202;space</p>', 'to minify to', '<p>hair space</p>');
    });

    it('should preserve a no-break space', function() {
      expect('<p>no-break space</p>', 'to minify to', '<p>no-break space</p>');
    });

    it('should preserve a no-break space encoded as a HTML entity', function() {
      expect(
        '<p>no-break&#160;space</p>',
        'to minify to',
        '<p>no-break&nbsp;space</p>'
      );
    });

    it('should preserve an en space', function() {
      expect('<p>en space</p>', 'to minify to', '<p>en space</p>');
    });

    it('should preserve an en space encoded as a HTML entity', function() {
      expect('<p>en&#8194;space</p>', 'to minify to', '<p>en space</p>');
    });

    it('should preserve an em space', function() {
      expect('<p>em space</p>', 'to minify to', '<p>em space</p>');
    });

    it('should preserve an em space encoded as a HTML entity', function() {
      expect('<p>em&#8195;space</p>', 'to minify to', '<p>em space</p>');
    });

    it('should preserve a zero-width space', function() {
      expect(
        '<p>zero-width​space</p>',
        'to minify to',
        '<p>zero-width​space</p>'
      );
    });

    it('should preserve a zero-width space encoded as a HTML entity', function() {
      expect(
        '<p>zero-width&#8203;space</p>',
        'to minify to',
        '<p>zero-width​space</p>'
      );
    });

    it('should preserve whitespace after SSI include in non-blocklevel context', function() {
      expect(
        '<div><span></span> <!--# echo "foo" --> bar</div>',
        'to minify to',
        '<div><span></span><!--# echo "foo" --> bar</div>'
      );
    });

    it('should remove whitespace before and after SSI include in block-level context', function() {
      expect(
        '<div><div></div> <!--# echo "foo" --> </div>',
        'to minify to',
        '<div><div></div><!--# echo "foo" --></div>'
      );
    });

    it('should remove whitespace between </title> and conditional comment in <head>', function() {
      expect(
        '<html><head><title>The title</title> <!--[if lt IE 8]><![endif]--></head><body></body></html>',
        'to minify to',
        '<html><head><title>The title</title><!--[if lt IE 8]><![endif]--></head><body></body></html>'
      );
    });

    it('should apply the configured html-minifier transformations', function() {
      expect(
        '<!DOCTYPE html>\n<html><head></head><body id=" " class="foo"><script type="text/javascript">foo();</script><input type="text" disabled="disabled"></body></html>',
        'to minify to',
        '<!DOCTYPE html><html><head></head><body class=foo><script>foo();</script><input type=text disabled></body></html>'
      );
    });

    it('should allow overriding the html-minifier options', function() {
      expect(
        '<div><!-- hey --></div>',
        'to minify to',
        '<div><!-- hey --></div>',
        htmlAsset => {
          htmlAsset.htmlMinifierOptions = { removeComments: false };
        }
      );
    });

    // https://github.com/kangax/html-minifier/pull/813
    it('should allow vetoing canTrimWhitespace', function() {
      expect(
        '<div>  foo  <span class="bar">  quux  </span>  baz  <pre>  </pre></div>',
        'to minify to',
        '<div>foo <span class=bar>  quux  </span>baz<pre>  </pre></div>',
        htmlAsset => {
          htmlAsset.htmlMinifierOptions = {
            canTrimWhitespace: function customTrimmer(
              tagName,
              attrs,
              defaultFn
            ) {
              if (
                attrs &&
                attrs.some(function(attr) {
                  return attr.name === 'class' && /\bbar\b/.test(attr.value);
                })
              ) {
                return false;
              }
              return defaultFn(tagName, attrs);
            }
          };
        }
      );
    });
  });

  describe('#prettyPrint()', function() {
    it('should format the document nicely', function() {
      const htmlAsset = new AssetGraph().addAsset({
        type: 'Html',
        text:
          '<!DOCTYPE html><html><head></head><body><span>foo</span></body></html>'
      });
      htmlAsset.prettyPrint();
      expect(
        htmlAsset.text,
        'to equal',
        '<!DOCTYPE html><html>\n<head>\n</head>\n<body>\n  <span>foo</span>\n</body>\n</html>'
      );
    });
  });

  describe('#allowsPerCsp', function() {
    let assetGraph;
    beforeEach(function() {
      assetGraph = new AssetGraph();
    });

    it('should support a non-camelCased directive name', function() {
      expect(
        assetGraph
          .addAsset({
            type: 'Html',
            text:
              '<!DOCTYPE html><html><head>' +
              '<meta http-equiv="Content-Security-Policy" content="style-src foo.com">' +
              '</head><body></body></html>'
          })
          .allowsPerCsp(
            'style-src',
            'http://foo.com/yeah.css',
            'http://example.com/index.html'
          ),
        'to be true'
      );
    });

    it('should support a camelCased directive name', function() {
      expect(
        assetGraph
          .addAsset({
            type: 'Html',
            url: 'http://example.com/index.html',
            text:
              '<!DOCTYPE html><html><head>' +
              '<meta http-equiv="Content-Security-Policy" content="style-src foo.com">' +
              '</head><body></body></html>'
          })
          .allowsPerCsp(
            'styleSrc',
            'http://foo.com/yeah.css',
            'http://example.com/index.html'
          ),
        'to be true'
      );
    });

    describe('with no CSPs', function() {
      it('should allow an http: url for any directive', function() {
        expect(
          assetGraph
            .addAsset({
              type: 'Html',
              url: 'http://example.com/index.html',
              text: '<!DOCTYPE html><html><head></head><body></body></html>'
            })
            .allowsPerCsp(
              'scriptSrc',
              'http://example.com/script.js',
              'http://example.com/index.html'
            ),
          'to be true'
        );
      });

      it('should allow a data: url for any directive', function() {
        expect(
          assetGraph
            .addAsset({
              type: 'Html',
              url: 'http://example.com/index.html',
              text: '<!DOCTYPE html><html><head></head><body></body></html>'
            })
            .allowsPerCsp(
              'imageSrc',
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQImWNQUFD4z6Crq/sfAAuYAuYl+7lfAAAAAElFTkSuQmCC',
              'http://example.com/index.html'
            ),
          'to be true'
        );
      });
    });

    describe('with multiple CSPs in effect', function() {
      describe('when both policies have the given directive', function() {
        it('should allow a url if both policies allow it', function() {
          expect(
            assetGraph
              .addAsset({
                type: 'Html',
                text:
                  '<!DOCTYPE html><html><head>' +
                  '<meta http-equiv="Content-Security-Policy" content="style-src foo.com">' +
                  '<meta http-equiv="Content-Security-Policy" content="style-src http://foo.com/">' +
                  '</head><body></body></html>'
              })
              .allowsPerCsp(
                'styleSrc',
                'http://foo.com/styles/myStyles.css',
                'http://example.com/index.html'
              ),
            'to be true'
          );
        });

        it("should disallow a url when one of the policies has 'none' for that directive", function() {
          expect(
            assetGraph
              .addAsset({
                type: 'Html',
                text:
                  '<!DOCTYPE html><html><head>' +
                  '<meta http-equiv="Content-Security-Policy" content="style-src foo.com">' +
                  '<meta http-equiv="Content-Security-Policy" content="style-src \'none\'">' +
                  '</head><body></body></html>'
              })
              .allowsPerCsp(
                'styleSrc',
                'http://foo.com/styles/myStyles.css',
                'http://example.com/index.html'
              ),
            'to be false'
          );
        });
      });

      describe('when one of the policies does not list that directive, but has a default-src directive', function() {
        it("should disallow the url when the default-src says 'none'", function() {
          expect(
            assetGraph
              .addAsset({
                type: 'Html',
                text:
                  '<!DOCTYPE html><html><head>' +
                  '<meta http-equiv="Content-Security-Policy" content="style-src foo.com">' +
                  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'">' +
                  '</head><body></body></html>'
              })
              .allowsPerCsp(
                'styleSrc',
                'http://foo.com/styles.css',
                'http://example.com/index.html'
              ),
            'to be false'
          );
        });

        it('should disallow the url when the default-src disallows it', function() {
          expect(
            assetGraph
              .addAsset({
                type: 'Html',
                text:
                  '<!DOCTYPE html><html><head>' +
                  '<meta http-equiv="Content-Security-Policy" content="style-src foo.com">' +
                  '<meta http-equiv="Content-Security-Policy" content="default-src http://bar.com/">' +
                  '</head><body></body></html>'
              })
              .allowsPerCsp(
                'styleSrc',
                'http://foo.com/styles.css',
                'http://example.com/index.html'
              ),
            'to be false'
          );
        });
      });
    });
  });

  it('should not evaluate inline scripts', function() {
    const htmlAsset = new AssetGraph().addAsset({
      type: 'Html',
      text:
        '<!DOCTYPE html><html><head></head><body><script>document.write("<foo>" + "</foo>");</script></body></html>'
    });
    // eslint-disable-next-line no-unused-expressions
    htmlAsset.parseTree;
    htmlAsset.markDirty();
    expect(htmlAsset.text, 'not to contain', '<foo></foo>');
  });

  it('should register the source location of inline scripts and stylesheets', async function() {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '../../testdata/assets/Html/sourceMapInlineAssets/'
      )
    });
    await assetGraph
      .loadAssets('index.html')
      .populate()
      .applySourceMaps();

    // FIXME: Make sure that it's sufficient to mark the containing asset dirty:
    assetGraph.findAssets({ type: 'JavaScript' })[0].markDirty();
    assetGraph.findAssets({ type: 'Css' })[0].markDirty();

    await assetGraph.externalizeRelations({
      type: { $in: ['HtmlStyle', 'HtmlScript'] }
    });

    for (const asset of assetGraph.findAssets({
      type: { $in: ['JavaScript', 'Css'] }
    })) {
      await asset.minify();
    }

    await assetGraph.serializeSourceMaps();

    expect(assetGraph, 'to contain asset', 'JavaScript');
    expect(assetGraph, 'to contain assets', 'Css', 2);
    expect(assetGraph, 'to contain assets', 'SourceMap', 2);
    const cssSourceMap = assetGraph.findRelations({
      type: 'CssSourceMappingUrl'
    })[0].to;
    expect(cssSourceMap.parseTree, 'to satisfy', {
      sources: [`${assetGraph.root}index.html`]
    });
    const cssSourceMapConsumer = new mozilla.SourceMapConsumer(
      cssSourceMap.parseTree
    );

    expect(
      cssSourceMapConsumer.generatedPositionFor({
        source: `${assetGraph.root}index.html`,
        line: 6,
        column: 17
      }),
      'to equal',
      {
        line: 1,
        column: 5,
        lastColumn: null
      }
    );

    expect(
      cssSourceMapConsumer.originalPositionFor({
        line: 1,
        column: 12
      }),
      'to equal',
      {
        source: `${assetGraph.root}index.html`,
        line: 6,
        column: 16,
        name: null
      }
    );

    const javaScriptSourceMap = assetGraph.findRelations({
      type: 'JavaScriptSourceMappingUrl'
    })[0].to;
    expect(javaScriptSourceMap.parseTree, 'to satisfy', {
      sources: [`${assetGraph.root}index.html`]
    });

    const javaScriptSourceMapConsumer = new mozilla.SourceMapConsumer(
      javaScriptSourceMap.parseTree
    );
    expect(
      javaScriptSourceMapConsumer.generatedPositionFor({
        source: `${assetGraph.root}index.html`,
        line: 13,
        column: 16
      }),
      'to equal',
      {
        line: 1,
        column: 8,
        lastColumn: null
      }
    );

    expect(
      javaScriptSourceMapConsumer.originalPositionFor({
        line: 1,
        column: 12
      }),
      'to equal',
      {
        source: `${assetGraph.root}index.html`,
        line: 13,
        column: 16,
        name: 'alert'
      }
    );
  });

  describe('with a base tag', function() {
    it('should interpret outgoing relations relative to the base href', async function() {
      const assetGraph = new AssetGraph({
        root: pathModule.resolve(
          __dirname,
          '../../testdata/assets/Html/base/external/'
        )
      });
      const [htmlAsset] = await assetGraph.loadAssets('index.html');
      await assetGraph.populate();

      expect(assetGraph, 'to contain assets', 3);
      expect(assetGraph, 'to contain asset', 'Css');
      expect(assetGraph, 'to contain asset', 'Png');

      const cssAsset = assetGraph.findAssets({ type: 'Css' })[0];
      expect(cssAsset, 'to have property', 'isLoaded', true);

      cssAsset.url = `${assetGraph.root}somewhere/else/styles.css`;
      expect(
        htmlAsset.outgoingRelations[0],
        'to have property',
        'href',
        '../somewhere/else/styles.css'
      );
    });

    it('should interpret outgoing relations in inline assets relative to the base href', async function() {
      const assetGraph = new AssetGraph({
        root: pathModule.resolve(
          __dirname,
          '../../testdata/assets/Html/base/inline/'
        )
      });
      await assetGraph.loadAssets('index.html');
      await assetGraph.populate();

      expect(assetGraph, 'to contain assets', 3);
      expect(assetGraph, 'to contain asset', 'Css');
      expect(assetGraph, 'to contain asset', { type: 'Png', isLoaded: true });

      const pngAsset = assetGraph.findAssets({ type: 'Png' })[0];

      pngAsset.url = `${assetGraph.root}somewhere/else/foo.png`;

      const cssAsset = assetGraph.findAssets({ type: 'Css' })[0];
      expect(
        cssAsset.outgoingRelations[0],
        'to have property',
        'href',
        '../somewhere/else/foo.png'
      );
    });
  });
});
