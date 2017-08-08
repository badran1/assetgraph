const expect = require('./unexpected-with-plugins');
const AssetGraph = require('../');
const httpception = require('httpception');
const sinon = require('sinon');
const pathModule = require('path');

describe('AssetGraph#add', function () {
    describe('with an array', function () {
        it('should throw', function () {
            expect(() => new AssetGraph().add([]), 'to throw', new Error('AssetGraph#add does not accept an array or glob patterns, try AssetGraph#addAll'));
        });
    });

    describe('with a glob pattern', function () {
        it('should throw', function () {
            expect(() => new AssetGraph().add('*.html'), 'to throw', new Error('AssetGraph#add does not accept an array or glob patterns, try AssetGraph#addAll'));
        });
    });

    it('should handle a relative path', async function () {
        const assetGraph = new AssetGraph({root: pathModule.resolve(__dirname, '..', 'testdata', 'add', 'relativeUrl') + '/'});
        const asset = assetGraph.add('foo.png');
        assetGraph.add(asset);
        await asset.load();
        expect(asset.type, 'to equal', 'Png');
    });

    it('should handle an http: url', async function () {
        httpception({
            request: 'GET http://www.example.com/foo.gif',
            response: {
                statusCode: 200,
                body: new Buffer('GIF')
            }
        });

        const assetGraph = new AssetGraph();
        const asset = assetGraph.add('http://www.example.com/foo.gif');
        assetGraph.add(asset);
        await asset.load();
        expect(asset, 'to be an object');
        expect(asset.url, 'to equal', 'http://www.example.com/foo.gif');
        expect(asset.type, 'to equal', 'Gif');
    });

    it('should handle a data: url', async function () {
        const assetGraph = new AssetGraph();
        const asset = assetGraph.add('data:text/html;base64,SGVsbG8sIHdvcmxkIQo=');
        assetGraph.add(asset);
        await asset.load();
        expect(asset, 'to be an object');
        expect(asset.rawSrc, 'to equal', new Buffer('Hello, world!\n', 'utf-8'));
    });

    it('should not loop infinitely when encountering non-resolvable urls', async function () {
        const assetGraph = new AssetGraph();
        const warnSpy = sinon.spy().named('warn');
        assetGraph.on('warn', warnSpy);

        const asset = assetGraph.add('my-funky.scheme://www.example.com/');
        assetGraph.add(asset);

        await asset.load();
        expect(warnSpy, 'to have calls satisfying', () => warnSpy(/^No resolver found for protocol: my-funky.scheme/));
    });

    it('should accept `-` as part of the protocol', async function () {
        const assetGraph = new AssetGraph();
        const warnSpy = sinon.spy().named('warn');

        assetGraph.on('warn', warnSpy);

        const asset = assetGraph.add('android-app://www.example.com/');
        await asset.load();
        expect(asset, 'to satisfy', { url: 'android-app://www.example.com/' });
        expect(warnSpy, 'was not called');
    });

    it('should only warn about unknown unsupported protocols', function () {
        const warnSpy = sinon.spy().named('warn');

        return new AssetGraph({root: __dirname + '/../testdata/unsupportedProtocols/'})
            .on('warn', warnSpy)
            .loadAssets('index.html')
            .populate()
            .then(function (assetGraph) {
                expect(assetGraph.findRelations(), 'to satisfy', [
                    { to: { url: 'mailto:foo@bar.com' } },
                    { to: { url: 'tel:9876543' } },
                    { to: { url: 'sms:9876543' } },
                    { to: { url: 'fax:9876543' } },
                    { to: { url: 'httpz://foo.com/' } }

                ]);

                expect(warnSpy, 'to have calls satisfying', () =>
                    warnSpy(new Error('No resolver found for protocol: httpz\n\tIf you think this protocol should exist, please contribute it here:\n\thttps://github.com/Munter/schemes#contributing'))
                );
            });
    });

    describe('with an asset config that includes the body', function () {
        it('should add the targets of all external outgoing relations as unloaded Asset instances', function () {
            const assetGraph = new AssetGraph();
            const asset = assetGraph.add({
                type: 'Css',
                url: 'https://example.com/styles.css',
                text: 'body { background-image: url(https://example.com/foo.png); }'
            });
            expect(asset, 'to be an', AssetGraph.Css);
            expect(assetGraph, 'to contain asset', {
                type: 'Asset',
                url: 'https://example.com/foo.png',
                isLoaded: false
            });
        });
    });

    describe('with an asset config that does not include the body', function () {
        it('should add the targets of all external outgoing relations as unloaded Asset instances once the asset is loaded', async function () {
            const assetGraph = new AssetGraph();
            const cssAsset = assetGraph.add({
                type: 'Css',
                url: 'https://example.com/styles.css'
            });

            httpception({
                request: 'GET https://example.com/styles.css',
                response: {
                    headers: {
                        'Content-Type': 'text/css'
                    },
                    body: 'body { background-image: url(https://example.com/foo.png); }'
                }
            });

            await cssAsset.load();

            expect(assetGraph, 'to contain asset', {
                type: 'Asset',
                url: 'https://example.com/foo.png',
                isLoaded: false
            });
        });
    });

    describe('when the url already exists in the graph', function () {
        it('should return the existing instance', function () {
            const assetGraph = new AssetGraph();
            const cssAsset = assetGraph.add({
                type: 'Css',
                url: 'https://example.com/styles.css',
                text: 'body { color: teal; }'
            });
            expect(cssAsset, 'to be a', AssetGraph.Css)
                .and('to satisfy', { text: 'body { color: teal; }' });

            const cssAsset2 = assetGraph.add({
                type: 'Css',
                url: 'https://example.com/styles.css',
                text: 'body { color: teal; }'
            });

            expect(cssAsset2, 'to be', cssAsset);
        });
    });

    describe('when more information arrives about an existing asset', function () {
        it('should upgrade from Xml to Atom (more specific)', async function () {
            const assetGraph = new AssetGraph();
            const xmlAsset = assetGraph.add({
                url: 'http://example.com/feed.xml',
                text: `
                    <?xml version="1.0" encoding="utf-8"?>
                    <feed xmlns="http://www.w3.org/2005/Atom">
                      <title>Example blog</title>
                      <updated>2014-08-29T00:11:13+02:00</updated>
                      <id>http://example.com/</id>
                      <entry>
                        <title>Karma Generator Rewrite 0.8.0</title>
                        <link href="http://example.com/blog/article/"/>
                        <updated>2014-05-12T00:00:00+02:00</updated>
                        <id>http://example.com/blog/article/</id>
                        <content type="html">This contains an image: &lt;img src=&quot;foo.png&quot;&gt; and a &lt;a href=&quot;bar.html&quot;&gt;relative link&lt;/a&gt;</content>
                      </entry>
                    </feed>
                `
            });

            await xmlAsset.load();

            expect(assetGraph, 'to contain no assets', 'Png');

            const infoSpy = sinon.spy().named('info');
            assetGraph.on('info', infoSpy);

            const atomAsset = assetGraph.add({
                url: 'http://example.com/feed.xml',
                contentType: 'application/atom+xml'
            });

            expect(atomAsset, 'to be', xmlAsset);

            await atomAsset.load();

            expect(assetGraph, 'to contain asset', 'Atom');
            expect(assetGraph, 'to contain asset', { fileName: 'foo.png' });
            expect(assetGraph, 'to contain no assets', 'Xml');
        });

        it('should not downgrade from Atom to Xml (less specific)', async function () {
            const assetGraph = new AssetGraph();
            const atomAsset = assetGraph.add({
                type: 'Atom',
                url: 'http://example.com/feed.xml',
                text: `
                    <?xml version="1.0" encoding="utf-8"?>
                    <feed xmlns="http://www.w3.org/2005/Atom">
                      <title>Example blog</title>
                      <updated>2014-08-29T00:11:13+02:00</updated>
                      <id>http://example.com/</id>
                      <entry>
                        <title>Karma Generator Rewrite 0.8.0</title>
                        <link href="http://example.com/blog/article/"/>
                        <updated>2014-05-12T00:00:00+02:00</updated>
                        <id>http://example.com/blog/article/</id>
                        <content type="html">This contains an image: &lt;img src=&quot;foo.png&quot;&gt; and a &lt;a href=&quot;bar.html&quot;&gt;relative link&lt;/a&gt;</content>
                      </entry>
                    </feed>
                `
            });

            await atomAsset.load();

            expect(assetGraph, 'to contain no assets', 'Png');

            const infoSpy = sinon.spy().named('info');
            assetGraph.on('info', infoSpy);

            assetGraph.add({ url: 'http://example.com/feed.xml', contentType: 'application/xml' });

            expect(assetGraph, 'to contain asset', 'Atom');
            expect(assetGraph, 'to contain asset', { fileName: 'foo.png' });
            expect(assetGraph, 'to contain no assets', 'Xml');
        });

        it('should upgrade an unloaded asset with text', async function () {
            const assetGraph = new AssetGraph();
            assetGraph.add({
                type: 'Css',
                url: 'http://example.com/styles.css',
                text: '@import "more.css";'
            });
            expect(assetGraph, 'to contain asset', {
                url: 'http://example.com/more.css'
            });
            await assetGraph.add({
                type: 'Css',
                url: 'http://example.com/more.css',
                text: 'body { color: teal; }'
            }).load();

            expect(assetGraph, 'to contain asset', {
                url: 'http://example.com/more.css',
                text: 'body { color: teal; }'
            });
            expect(assetGraph, 'to contain assets', 2);
            expect(assetGraph, 'to contain relation', {
                type: 'CssImport',
                from: {
                    url: 'http://example.com/styles.css'
                },
                to: {
                    url: 'http://example.com/more.css'
                }
            });
        });
    });
});