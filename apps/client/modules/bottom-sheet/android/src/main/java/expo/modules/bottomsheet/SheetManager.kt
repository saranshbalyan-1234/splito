// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - modules/bottom-sheet/android/src/main/java/expo/modules/bottomsheet/SheetManager.kt
package expo.modules.bottomsheet

import java.lang.ref.WeakReference

class SheetManager {
  companion object {
    private val sheets = mutableSetOf<WeakReference<BottomSheetView>>()

    fun add(view: BottomSheetView) {
      sheets.add(WeakReference(view))
    }

    fun remove(view: BottomSheetView) {
      sheets.forEach {
        if (it.get() == view) {
          sheets.remove(it)
          return
        }
      }
    }

    fun dismissAll() {
      sheets.forEach {
        it.get()?.dismiss()
      }
    }
  }
}
