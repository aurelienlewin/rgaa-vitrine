import app from './app.js'

const port = Number.parseInt(process.env.PORT ?? '8787', 10)

app.listen(port, () => {
  console.log(`API RGAA Pride running on http://127.0.0.1:${port}`)
})
