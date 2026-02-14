// app.config.js
import 'dotenv/config';

export default {
  expo: {
    name: 'Marcacion',
    slug: 'marcacion-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'marcacion',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,

    // --- AQUÍ ESTÁ LA CLAVE: DEFINICIÓN EXPLÍCITA ---
    platforms: [
      "ios",
      "android",
      "web"
    ],

    web: {
      bundler: 'metro', // Obligatorio para Expo Router
      output: 'static',
      display: 'standalone',
      themeColor: "#007AFF",
      backgroundColor: "#ffffff",
      favicon: "./assets/images/favicon.png",
      shortName: "Marcacion",
      startUrl: "/",
      meta: {
        apple: {
          mobileWebAppCapable: "yes",
          mobileWebAppStatusBarStyle: "black-translucent"
        },
        viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
      }
    },
    // ------------------------------------------------

    ios: {
      supportsTablet: true,
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
      },
    },

    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      package: "com.medianaranja.app",
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      // usesCleartextTraffic se maneja mejor aquí directamente
      permissions: ["INTERNET"] 
    },

    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000"
          }
        }
      ],
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: true
          }
        }
      ]
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: true
    },

    extra: {
        apiUrl: 'http://10.15.0.221:5005',     
        eas: {
        projectId: "d095ba94-d018-4dfc-bee2-adf6b7e6c1c6"
      }
    },
    
    owner: "kedal12"
  }
};