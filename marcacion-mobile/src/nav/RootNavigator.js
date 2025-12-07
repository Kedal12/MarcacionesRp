    import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext'; // Importa el hook de autenticación

    // Importa tus pantallas
    import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
    // import HistorialScreen from '../screens/HistorialScreen'; // Descomenta cuando la tengas
    // Importa otras pantallas de tu AppStack aquí...

    // Importa un componente de Carga (puedes crear uno simple)
    import LoadingIndicator from '../components/LoadingIndicator'; // Asume que creas este componente

    const Stack = createNativeStackNavigator();

    // Stack de Autenticación (solo Login por ahora)
    const AuthStack = () => (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        {/* Podrías añadir pantallas de Registro, Olvidé Contraseña aquí si las haces */}
      </Stack.Navigator>
    );

    // Stack Principal de la Aplicación (cuando está logueado)
    const AppStack = () => (
      <Stack.Navigator>
        {/* Pantalla Principal */}
        <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Inicio' /* Opciones de cabecera */ }}
        />
        {/* Pantalla de Historial */}
        {/* <Stack.Screen
            name="Historial"
            component={HistorialScreen}
            options={{ title: 'Mi Historial' }}
         /> */}
        {/* Añade otras pantallas aquí (Perfil, etc.) */}

      </Stack.Navigator>
    );

    // Componente principal de navegación
    export default function RootNavigator() {
      const { token, isLoading } = useAuth(); // Obtiene estado del AuthContext

      // Muestra indicador de carga mientras se valida el token inicial
      if (isLoading) {
        return <LoadingIndicator />; // Muestra pantalla/componente de carga
      }

      // Decide qué stack mostrar basado en la presencia del token
      return (
        <NavigationContainer>
          {token ? <AppStack /> : <AuthStack />}
        </NavigationContainer>
      );
    }
    
