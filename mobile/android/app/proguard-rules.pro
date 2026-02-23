# REL-007: ProGuard/R8 Rules for FindMyStar
#
# Keep rules for React Native and native modules

# React Native
-keep class com.facebook.** { *; }
-keep class com.facebook.react.** { *; }
-dontwarn com.facebook.**

# Hermes engine
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# FindMyStar native bridge (JNI)
-keep class com.findmystar.AstronomyBridgeModule { *; }
-keep class com.findmystar.AstronomyBridgePackage { *; }
-keepclassmembers class com.findmystar.AstronomyBridgeModule {
    native <methods>;
}

# React Native SQLite Storage
-keep class org.pgsqlite.** { *; }
-dontwarn org.pgsqlite.**

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# React Navigation
-keep class com.swmansion.rnscreens.** { *; }
-dontwarn com.swmansion.rnscreens.**

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums (used in React Native bridge)
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelables
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Remove logging in release
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
