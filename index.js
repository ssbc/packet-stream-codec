
var Through = require('pull-through')
var Reader = require('pull-reader')

var BUFFER = 0, STRING = 1, OBJECT = 2

function isObject (o) {
  return o && 'object' === typeof o
}

var isBuffer = Buffer.isBuffer

function isString (s) {
  return 'string' === typeof s
}

function encodePair (msg) {

  var head = new Buffer(9)
  var flags = 0
  var value = msg.value || msg.end
  console.log(value)
  if(isString(value)) {
    flags = STRING
    value = new Buffer(value)
  }
  else if(isBuffer(value)) {
    flags = BUFFER
  }
  else {
    flags = OBJECT
    value = new Buffer(JSON.stringify(value))
  }

  // does this frame represent a msg, a req, or a stream?

  flags = ((
    !msg.req && !msg.stream ? 0 // message
  : !msg.stream             ? 1 // req
  : !msg.end                ? 2 // stream, but not final packet
  :                           3 // last packet in stream!
  ) << 6) | flags

  head[0] = flags

  head.writeUInt32BE(value.length, 1)
  head.writeInt32BE(msg.req || 0, 5)

  return [head, value]
}

function decodeHead (bytes) {
  if(bytes.length != 9)
    throw new Error('expected header to be 9 bytes long')
  var flags = bytes[0]
  var length = bytes.readUInt32BE(1)
  var req = bytes.readInt32BE(5)

  console.log(flags, flags.toString(2))

  return {
    req: req,
    stream: flags >= 128 ? true : false,
    end: (flags >> 6) === 3,
    value: null,
    length: length,
    type: flags & 3
  }
}

function decodeBody (bytes, msg) {
  if(BUFFER === msg.type) msg.value = bytes
  else if(STRING === msg.type) msg.value = bytes.toString()
  else if(OBJECT === msg.type) msg.value = JSON.parse(bytes.toString())
  else throw new Error('unknown message type')
  return msg
}

function encode () {
  return Through(function (d) {
    var c = encodePair(d)
    this.queue(c[0])
    this.queue(c[1])
  })
}

function decode () {
  var reader = Reader()

  return function (read) {
    reader(read)

    return function (abort, cb) {
      if(abort) return reader.abort(abort, cb)
      reader.read(9, function (err, head) {
        if(err) return cb(err)
        var msg = decodeHead(head)
        reader.read(msg.length, function (err, body) {
          if(err) return cb(err)
          decodeBody(body, msg)
          cb(null, msg)
        })
      })
    }
  }
}

exports = module.exports = function (stream) {
  return {
    source: encode()(stream.source),
    sink: function (read) { return stream.sink(decode()(read)) }
  }
}

exports.encodePair = encodePair
exports.decodeHead = decodeHead
exports.decodeBody = decodeBody

exports.encode = encode
exports.decode = decode

