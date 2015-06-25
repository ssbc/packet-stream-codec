
const BUFFER = 0, STRING = 1, OBJECT = 2

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

exports.encodePair = encodePair
exports.decodeHead = function (bytes) {
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

exports.decodeBody = function (bytes, msg) {
  if(BUFFER === msg.type) msg.value = bytes
  else if(STRING === msg.type) msg.value = bytes.toString()
  else if(OBJECT === msg.type) msg.value = JSON.parse(bytes.toString())
  else throw new Error('unknown message type')
  return msg
}
