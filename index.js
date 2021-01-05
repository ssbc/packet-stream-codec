
var Through = require('pull-through')
var Reader = require('pull-reader')

var BUFFER = 0, STRING = 1, OBJECT = 2

var GOODBYE = 'GOODBYE'
var isBuffer = Buffer.isBuffer

function isString (s) {
  return 'string' === typeof s
}

function encodePair (msg) {

  var head = Buffer.alloc(9)
  var flags = 0
  var value = msg.value !== undefined ? msg.value : msg.end

  //final packet
  if(isString(msg) && msg === GOODBYE) {
    head.fill(0)
    return [head, null]
  }

  if(isString(value)) {
    flags = STRING
    value = Buffer.from(value, 'utf-8')
  }
  else if(isBuffer(value)) {
    flags = BUFFER
  }
  else {
    flags = OBJECT
    value = Buffer.from(JSON.stringify(value), 'utf-8')
  }

  // does this frame represent a msg, a req, or a stream?

  //end, stream

  flags = msg.stream << 3 | msg.end << 2 | flags

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

  return {
    req    : req,
    stream : !!(flags & 8),
    end    : !!(flags & 4),
    value  : null,
    length : length,
    type   : flags & 3
  }
}

function decodeBody (bytes, msg) {
  if(bytes.length !== msg.length)
    throw new Error('incorrect length, expected:'+msg.length+' found:'+bytes.length)
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
    if(c[1] !== null)
      this.queue(c[1])
  })
}

function decode () {
  var reader = Reader(), ended = false

  return function (read) {
    reader(read)

    return function (abort, cb) {
      if(ended) return cb(true)
      if(abort) return reader.abort(abort, cb)
      reader.read(9, function (err, head) {
        if(err) return cb(err)
        var msg = decodeHead(head)
        if(msg.length === 0) { //final packet
          ended = true
          return cb(null, GOODBYE)
        }
        reader.read(msg.length, function (err, body) {
          if(err) return cb(err)
          try {
            decodeBody(body, msg)
          } catch(e) {
            return cb(e)
          }
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

