'use strict'
const Bluebird = require('bluebird')
const gpio = require('rpi-gpio')

Bluebird.promisifyAll(gpio)

const ANODES = [12, 16, 18]
const CATHODES = [7, 11, 15]
const INPUT = 22
const SCAN_INTERVAL = 2
const FRAME_DURATION = 200

const animations = [
  [
    [[1, 0, 0], [1, 0, 0], [1, 0, 0]],
    [[0, 1, 0], [0, 1, 0], [0, 1, 0]],
    [[0, 0, 1], [0, 0, 1], [0, 0, 1]],
    [[0, 1, 0], [0, 1, 0], [0, 1, 0]]
  ]
]
let frame = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
let anode = 2
let shutDown = false

const animate = () => {
  let animation = 0
  let curFrame = animations[animation].length - 1
  scan()
  setInterval(() => {
    curFrame = (curFrame + 1) % animations[animation].length
    frame = animations[animation][curFrame]
  }, FRAME_DURATION)
} 

const exit = code => {
  gpio.destroy((e) => {
    if (e) console.log('Error on Destroy:', e.stack)
    process.exit(code || 0)
  })
}

const scan = () => {
  if (shutDown) return null
  const cathodeOff = []
  for (let i = 0; i < 3; i++) {
    cathodeOff.push(gpio.writeAsync(CATHODES[i], 1))
  }
  return gpio.writeAsync(ANODES[anode], 0)
    .then(() => Bluebird.all(cathodeOff))
    .then(() => {
      const cathodeOn = []
      anode = (anode + 1) % 3
      for (let i = 0; i < 3; i++) {
        if (frame[anode][i]) {
          cathodeOn.push(gpio.writeAsync(CATHODES[i], 0))
        }
      }
      return Bluebird.all(cathodeOn)
    })
    .then(() => gpio.writeAsync(ANODES[anode], 1))
    .then(() => setImmediate(scan))
    .catch(e => {
      console.log('Error on Scan:', e.stack)
      setLowAndExit(2)
    })
}

const setLowAndExit = code => {
  shutDown = true
  Bluebird.resolve(ANODES)
    .each(anode => {
      return gpio.writeAsync(anode, 0)
    })
    .then(() => exit(code + 1))
    .catch(() => exit(code + 1))
}

process.on('SIGINT', () => {
  setLowAndExit(20)
})

Bluebird.resolve(ANODES.concat(CATHODES))
  .each(pin => {
    return gpio.setupAsync(pin, gpio.DIR_OUT).then(() => {
      return gpio.writeAsync(pin, CATHODES.indexOf(pin) > -1)
    })
  })
  .then(animate)
  .catch((e) => {
    console.log('Error on main thread:', e.stack)
    setLowAndExit(1)
  })

