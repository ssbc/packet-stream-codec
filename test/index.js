const tape = require('tape')
const pull = require('pull-stream')
const split = require('pull-randomly-split')

const psc = require('../')

function flat(err) {
  return {
    message: err.message,
    name: err.name,
    stack: err.stack,
  }
}

const examples = [
  // an event:
  { req: 0, stream: false, end: false, value: ['event', { okay: true }] },
  // a request:
  { req: 1, stream: false, end: false, value: 'whatever' },
  // a stream packet:
  { req: 2, stream: true, end: false, value: Buffer.from('hello', 'utf-8') },
  // a stream response:
  { req: -2, stream: true, end: false, value: Buffer.from('goodbye', 'utf-8') },
  { req: -3, stream: false, end: true, value: flat(new Error('intentional')) },
  // a stream packet:
  { req: 2, stream: true, end: true, value: true },
  // a stream response:
  { req: -2, stream: true, end: true, value: true },
  // a large buffer:
  { req: 1, stream: false, end: false, value: Buffer.alloc(1024 * 1024) },
  'GOODBYE',
]

tape('simple', (t) => {
  examples.forEach((e) => {
    const [head, value] = psc.encodePair(e)

    let msg = psc.decodeHead(head)

    if (value) {
      t.equal(msg.length, value.length)
      msg = psc.decodeBody(value, msg)
      delete msg.length
      delete msg.type
      t.deepEqual(e, msg)
    }
  })
  t.end()
})

tape('streaming', (t) => {
  pull(
    pull.values(examples),
    psc.encode(),
    split(),
    psc.decode(),
    pull.collect((err, actual) => {
      t.error(err, 'no error')
      examples.forEach((expected, i) => {
        delete actual[i].length
        delete actual[i].type

        t.deepEqual(actual[i], expected)
      })
      t.end()
    })
  )
})

tape('streaming', (t) => {
  const duplex = {
    source: pull.values(examples),
    sink: pull.collect((err, actual) => {
      t.error(err, 'no error')
      examples.forEach((expected, i) => {
        delete actual[i].length
        delete actual[i].type

        t.deepEqual(actual[i], expected)
      })
      t.end()
    }),
  }

  const s = psc(duplex)

  pull(s, s)
})
