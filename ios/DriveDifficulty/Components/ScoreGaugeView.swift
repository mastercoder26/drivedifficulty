import SwiftUI

struct ScoreGaugeView: View {
    let score: Double
    let label: DifficultyLabel

    private var progress: Double {
        min(max(score / 10.0, 0), 1)
    }

    private var accentColor: Color {
        let rgb = label.systemColor
        return Color(red: rgb.red, green: rgb.green, blue: rgb.blue)
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color(.systemGray5), lineWidth: 14)

            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    accentColor,
                    style: StrokeStyle(lineWidth: 14, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.easeOut(duration: 0.6), value: progress)

            VStack(spacing: 4) {
                Text(String(format: "%.1f", score))
                    .font(.system(size: 64, weight: .bold, design: .rounded))
                    .foregroundStyle(.primary)
                    .contentTransition(.numericText())

                Text("/ 10")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 200, height: 200)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Difficulty score \(String(format: "%.1f", score)) out of 10, \(label.rawValue)")
    }
}

#Preview {
    ScoreGaugeView(score: 4.2, label: .easy)
        .padding()
}
