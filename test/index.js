
var tape = require('tape')
var pull = require('pull-stream')
var split = require('pull-randomly-split')

var psc = require('../')

function flat (err) {
  return {
    message: err.message,
    name: err.name,
    stack: err.stack
  }
}

var examples = [
  {req: 0, stream: false, end: false, value: ['event', {okay: true}]}, //an event

  {req: 1, stream: false, end: false, value: 'whatever'}, //a request
  {req:  2, stream: true, end: false, value: Buffer.from('hello')}, //a stream packet
  {req: -2, stream: true, end: false, value: Buffer.from('goodbye')}, //a stream response
  {req: -3, stream: false, end: true, value: flat(new Error('intentional'))},
  {req:  2, stream: true, end: true, value: true}, //a stream packet
  {req: -2, stream: true, end: true, value: true}, //a stream response
  {req: 1, stream: false, end: false, value: Buffer.alloc(1024*1024)}, //a large buffer
  "GOODBYE"
]

tape('simple', function (t) {
  examples.forEach(function (e) {
    var c = psc.encodePair(e)

    var msg = psc.decodeHead(c[0])

    if(c[1]) {
      t.equal(msg.length, c[1].length)
      msg = psc.decodeBody(c[1], msg)
      delete msg.length
      delete msg.type
      t.deepEqual(e, msg)
    }
  })
  t.end()
})

tape('streaming', function (t) {

  pull(
    pull.values(examples),
    psc.encode(),
    split(),
    psc.decode(),
    pull.collect(function (err, actual) {

      examples.forEach(function (expected, i) {
        delete actual[i].length
        delete actual[i].type

        t.deepEqual(actual[i], expected)
      })
      t.end()
    })
  )

})

tape('streaming', function (t) {

  var duplex = {
    source: pull.values(examples),
    sink: pull.collect(function (err, actual) {

      examples.forEach(function (expected, i) {
        delete actual[i].length
        delete actual[i].type

        t.deepEqual(actual[i], expected)
      })
      t.end()
    })

  }

  var s = psc(duplex)

  pull(s, s)

})

