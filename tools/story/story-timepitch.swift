// Offline pitch and pace change for the story voice builder.
//
// Renders a WAV through AVAudioUnitTimePitch (Apple's phase-vocoder time/pitch
// unit) in manual rendering mode, so pitch and pace are set independently:
// the child voices go up in pitch without being rushed, and every voice can be
// slowed to a child-friendly pace.
//
//   story-timepitch <in.wav> <out.wav> <pitch-cents> <rate>
//
// rate < 1 slows the speech down (0.8 = 25% longer). Output is 32-bit float
// WAV at the input's sample rate; the Python builder converts it to 16-bit.
import AVFoundation

let args = CommandLine.arguments
guard args.count == 5, let cents = Float(args[3]), let rate = Float(args[4]) else {
    FileHandle.standardError.write("usage: story-timepitch in.wav out.wav cents rate\n".data(using: .utf8)!)
    exit(2)
}

do {
    let input = try AVAudioFile(forReading: URL(fileURLWithPath: args[1]))
    let format = input.processingFormat
    let engine = AVAudioEngine()
    let player = AVAudioPlayerNode()
    let unit = AVAudioUnitTimePitch()
    unit.pitch = cents
    unit.rate = rate
    unit.overlap = 16          // smoother voice at the cost of render time
    engine.attach(player)
    engine.attach(unit)
    engine.connect(player, to: unit, format: format)
    engine.connect(unit, to: engine.mainMixerNode, format: format)
    try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 4096)
    try engine.start()
    player.scheduleFile(input, at: nil)
    player.play()

    let output = try AVAudioFile(forWriting: URL(fileURLWithPath: args[2]), settings: format.settings)
    let buffer = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat,
                                  frameCapacity: engine.manualRenderingMaximumFrameCount)!
    // The stretched length plus a tail so the unit's latency is flushed out.
    let total = AVAudioFramePosition(Double(input.length) / Double(rate)) + AVAudioFramePosition(format.sampleRate * 0.25)
    while engine.manualRenderingSampleTime < total {
        let frames = min(AVAudioFrameCount(total - engine.manualRenderingSampleTime), buffer.frameCapacity)
        let status = try engine.renderOffline(frames, to: buffer)
        if status == .success { try output.write(from: buffer) } else if status == .error { exit(1) }
    }
    player.stop()
    engine.stop()
} catch {
    FileHandle.standardError.write("story-timepitch: \(error)\n".data(using: .utf8)!)
    exit(1)
}
