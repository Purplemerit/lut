import type { BeautyParams, LookId } from '../types'
import { LUT_GRADES, LUT_SIZE, bakeLut } from './luts'
import { LUT_FRAG, QUAD_VERT } from './shaders'

const QUAD = new Float32Array([
  -1, -1, 0, 0,
  1, -1, 1, 0,
  -1, 1, 0, 1,
  1, 1, 1, 1,
])

const LOOK_IDS = Object.keys(LUT_GRADES) as LookId[]

export class BeautyEngine {
  private gl: WebGL2RenderingContext | null = null
  private video: HTMLVideoElement | null = null
  private observer: ResizeObserver | null = null
  private lookId: LookId = 'soft'
  private strength = 0.85
  private mirrored = true
  private destroyed = false
  private running = false
  private frameMode: 'vfc' | 'raf' = 'raf'
  private frameId = 0
  private width = 0
  private height = 0
  private hasFrame = false
  private captureResolvers: ((blob: Blob | null) => void)[] = []
  private videoTex: WebGLTexture | null = null
  private quadVao: WebGLVertexArrayObject | null = null
  private program: WebGLProgram | null = null
  private luts = new Map<LookId, WebGLTexture>()

  constructor(private canvas: HTMLCanvasElement) {}

  async init(): Promise<void> {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    })
    if (!gl) throw new Error('WebGL2 is not available in this browser.')
    this.gl = gl
    this.program = link(gl, QUAD_VERT, LUT_FRAG)
    this.createGeometry()
    this.createLuts()
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(this.canvas)
    this.resize()
  }

  setParams(params: BeautyParams) {
    this.lookId = params.lookId
    this.strength = params.strength
  }

  setMirrored(mirrored: boolean) {
    this.mirrored = mirrored
  }

  start(video: HTMLVideoElement) {
    if (this.destroyed || !this.gl) return
    this.cancelFrame()
    this.video = video
    this.running = true
    this.schedule()
  }

  stop() {
    this.running = false
    this.cancelFrame()
    this.video = null
    const pending = this.captureResolvers.splice(0)
    for (const resolve of pending) resolve(null)
  }

  capture(): Promise<Blob | null> {
    if (!this.running || !this.gl) return Promise.resolve(null)
    return new Promise((resolve) => this.captureResolvers.push(resolve))
  }

  destroy() {
    this.destroyed = true
    this.stop()
    this.observer?.disconnect()
    const gl = this.gl
    if (gl) {
      if (this.videoTex) gl.deleteTexture(this.videoTex)
      for (const texture of this.luts.values()) gl.deleteTexture(texture)
      if (this.program) gl.deleteProgram(this.program)
    }
    this.luts.clear()
    this.gl = null
  }

  private schedule() {
    const video = this.video
    if (!video || !this.running) return
    if (typeof video.requestVideoFrameCallback === 'function') {
      this.frameMode = 'vfc'
      this.frameId = video.requestVideoFrameCallback(() => {
        this.frame()
        this.schedule()
      })
      return
    }
    this.frameMode = 'raf'
    this.frameId = requestAnimationFrame(() => {
      this.frame()
      this.schedule()
    })
  }

  private cancelFrame() {
    if (!this.frameId) return
    if (this.frameMode === 'vfc') this.video?.cancelVideoFrameCallback?.(this.frameId)
    else cancelAnimationFrame(this.frameId)
    this.frameId = 0
  }

  private frame() {
    const gl = this.gl
    const video = this.video
    if (!gl || !video || !this.running || !this.program || !this.videoTex) return
    if (this.width < 2 || this.height < 2) return
    if (video.readyState < 2 || video.videoWidth < 2 || video.videoHeight < 2) {
      if (!this.hasFrame) this.clearScreen()
      return
    }

    gl.bindTexture(gl.TEXTURE_2D, this.videoTex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)

    const scale = Math.max(this.width / video.videoWidth, this.height / video.videoHeight)
    const displayedW = video.videoWidth * scale
    const displayedH = video.videoHeight * scale
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)
    gl.disable(gl.BLEND)
    gl.useProgram(this.program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.videoTex)
    gl.uniform1i(gl.getUniformLocation(this.program, 'uVideo'), 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_3D, this.luts.get(this.lookId) ?? this.luts.get('original')!)
    gl.uniform1i(gl.getUniformLocation(this.program, 'uLut'), 1)
    gl.uniform2f(gl.getUniformLocation(this.program, 'uUvScale'), this.width / displayedW, this.height / displayedH)
    gl.uniform1f(gl.getUniformLocation(this.program, 'uMirror'), this.mirrored ? 1 : 0)
    gl.uniform1f(gl.getUniformLocation(this.program, 'uStrength'), this.strength)
    gl.uniform1f(gl.getUniformLocation(this.program, 'uLutScale'), (LUT_SIZE - 1) / LUT_SIZE)
    gl.uniform1f(gl.getUniformLocation(this.program, 'uLutOffset'), 0.5 / LUT_SIZE)
    gl.bindVertexArray(this.quadVao)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindVertexArray(null)
    this.hasFrame = true
    this.finishCapture()
  }

  private clearScreen() {
    const gl = this.gl
    if (!gl) return
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0.965, 0.941, 0.925, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  private finishCapture() {
    if (this.captureResolvers.length === 0) return
    const gl = this.gl
    if (!gl) return
    const w = this.width
    const h = this.height
    const pixels = new Uint8Array(w * h * 4)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    const copy = document.createElement('canvas')
    copy.width = w
    copy.height = h
    const ctx = copy.getContext('2d')
    const waiters = this.captureResolvers.splice(0)
    if (!ctx) {
      for (const resolve of waiters) resolve(null)
      return
    }
    const image = ctx.createImageData(w, h)
    const row = w * 4
    for (let y = 0; y < h; y++) image.data.set(pixels.subarray((h - 1 - y) * row, (h - y) * row), y * row)
    ctx.putImageData(image, 0, 0)
    copy.toBlob((blob) => {
      for (const resolve of waiters) resolve(blob)
    }, 'image/png')
  }

  private resize() {
    const gl = this.gl
    if (!gl) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = Math.round(this.canvas.clientWidth * dpr)
    let h = Math.round(this.canvas.clientHeight * dpr)
    const longest = Math.max(w, h)
    if (longest > 1440) {
      const scale = 1440 / longest
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }
    w -= w % 2
    h -= h % 2
    if (w < 2 || h < 2 || (w === this.width && h === this.height)) return
    this.canvas.width = w
    this.canvas.height = h
    this.width = gl.drawingBufferWidth - (gl.drawingBufferWidth % 2)
    this.height = gl.drawingBufferHeight - (gl.drawingBufferHeight % 2)
  }

  private createLuts() {
    const gl = this.gl
    if (!gl) return
    for (const id of LOOK_IDS) {
      const data = bakeLut(LUT_GRADES[id])
      const texture = gl.createTexture()
      if (!texture) throw new Error('Could not create a color look.')
      gl.bindTexture(gl.TEXTURE_3D, texture)
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, LUT_SIZE, LUT_SIZE, LUT_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
      this.luts.set(id, texture)
    }
    gl.bindTexture(gl.TEXTURE_3D, null)
  }

  private createGeometry() {
    const gl = this.gl
    if (!gl) return
    const buffer = gl.createBuffer()
    this.quadVao = gl.createVertexArray()
    this.videoTex = gl.createTexture()
    if (!buffer || !this.quadVao || !this.videoTex) throw new Error('Could not prepare the camera view.')
    gl.bindVertexArray(this.quadVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)
    gl.bindVertexArray(null)
    gl.bindTexture(gl.TEXTURE_2D, this.videoTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }
}

function link(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram()
  if (!program) throw new Error('Could not create a shader program.')
  const vs = compile(gl, gl.VERTEX_SHADER, vertex)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment)
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.bindAttribLocation(program, 0, 'aPos')
  gl.bindAttribLocation(program, 1, 'aUv')
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Shader link failed')
  }
  return program
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Could not create a shader.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'Shader compile failed'
    gl.deleteShader(shader)
    throw new Error(log)
  }
  return shader
}
