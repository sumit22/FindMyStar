import Foundation
import UIKit

@objc(KeepAwake)
class KeepAwake: NSObject {

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func activate() {
    DispatchQueue.main.async {
      UIApplication.shared.isIdleTimerDisabled = true
    }
  }

  @objc
  func deactivate() {
    DispatchQueue.main.async {
      UIApplication.shared.isIdleTimerDisabled = false
    }
  }
}
