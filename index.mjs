import express from 'express';
import { readFileSync } from 'fs';
import { Lru } from './lru.mjs'
const app = express()
const port = Number(process.env.PORT ?? 3000)

if (isNaN(port)) throw new Error('$PORT is not a number');
if (process.env.BASEMAPS_API_KEY == null) throw new Error('Please grab a API key from basemaps.linz.govt.nz and set it as $BASEMAPS_API_KEY');


const cache = new Lru();

const exts = new Set(['webp', 'jpeg', 'png', 'avif',])
const clients = ['leaflet', 'maplibre', 'ol']
const status = [200, 204, 404, 500]

app.get('/', (req, res) => {
    res.header('content-type', 'text/html')
    res.end(
        [...exts].map((ext => {
            return status.map(status => {
                return [
                    `Status ${status} - <a href="/${status}/{z}/{x}/{y}.${ext}">/${status}/{z}/{x}/{y}.${ext}</a>`,
                    `<ul>`,
                    ...clients.map(f => `<li><a href="./${status}/${ext}/${f}.html">${status} -  ${f}</a></li>`),
                    `</ul>`
                ].join('\n')
            }).join('\n')
        })).join('\n')
    )
})



for (const client of clients) {
    app.get(`/:status/:ext/${client}.html`, (req, res) => {
        if (!exts.has(req.params.ext)) return res.status(400).send('Failed')

        res.status(200)
        res.header('content-type', 'text/html')
        res.end(String(readFileSync(`./src/${client}.html`)).replace('{ext}', req.params.ext))
    })
}


const targetUrl = `https://dev.basemaps.linz.govt.nz/v1/tiles/gisborne-2022-2023-0.1m/WebMercatorQuad/{z}/{x}/{y}.{ext}?api=` + process.env.BASEMAPS_API_KEY



app.get('/:status/:z/:x/:y.:ext', async (req, res) => {
    const target = targetUrl.replace('{z}', req.params.z).replace('{x}', req.params.x).replace('{y}', req.params.y).replace('{ext}', req.params.ext)
    if (isNaN(req.params.status)) return res.status(400).send('Failed')
    if (isNaN(req.params.x)) return res.status(400).send('Failed')
    if (isNaN(req.params.y)) return res.status(400).send('Failed')
    if (isNaN(req.params.z)) return res.status(400).send('Failed')

    if (!exts.has(req.params.ext)) return res.status(400).send('Failed')


    const key = [req.params.z, req.params.x, req.params.y].join("-") + '.' + req.params.ext
    const tileReq = cache.get(key, () => fetch(target));

    const response = await tileReq.promise;

    console.log({ key, status: response.status })
    tileReq.status = response.status
    if (response.status === 204 || response.headers.get('content-length') === 0) {
        res.status(Number(req.params.status))
        res.end();
        return;
    }

    res.status(200);
    res.header('content-type', response.headers.get('content-type'))
    res.header('cache-control', response.headers.get('cache-control'))
    if (response.$body == null) response.$body = response.arrayBuffer().then(ab => Buffer.from(ab))
    const body = await response.$body;
    res.end(body)
})

app.get('/stats.json', (req, res) => {
    res.header('content-type', 'application/json');
    return res.status(200).send(JSON.stringify(cache.toJSON()));
})

app.listen(port, () => {
    console.log(`Started - http://localhost:${port}`)
})