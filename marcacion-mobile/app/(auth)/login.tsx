import { useAuth } from '@/src/auth/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function LoginScreen() {
  const { loginWithDocument } = useAuth();
  
  // ✅ Solo necesitamos el número de documento
  const [documento, setDocumento] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const docTrimmed = documento.trim();
    
    if (!docTrimmed) {
      Alert.alert('Campo requerido', 'Ingresa tu número de documento.');
      return;
    }

    setLoading(true);
    try {
      console.log('🔄 Iniciando sesión con documento...');
      
      await loginWithDocument(docTrimmed);
      
      console.log('✅ Login exitoso. Redirigiendo...');
      
    } catch (err: any) {
      console.log('❌ Error en login:', err);
      
      // Mensaje amigable según el error
      let message = 'No se pudo iniciar sesión.';
      if (err?.response?.status === 401) {
        message = 'Documento no encontrado o usuario inactivo.';
      } else if (err?.message) {
        message = err.message;
      }
      
      Alert.alert('Error al iniciar sesión', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        {/* Logo o icono */}
        <View style={styles.iconContainer}>
          <Ionicons name="finger-print" size={80} color="#007AFF" />
        </View>
        
        <Text style={styles.title}>Marcación</Text>
        <Text style={styles.subtitle}>Ingresa con tu documento</Text>

        {/* Input de documento */}
        <View style={styles.inputContainer}>
          <Ionicons name="card-outline" size={22} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Número de documento"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={documento}
            onChangeText={setDocumento}
            autoFocus
            maxLength={15}
          />
        </View>

        {/* Botón de login */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="log-in-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Ingresar</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Texto de ayuda */}
        <Text style={styles.helpText}>
          Ingresa el número de documento registrado en el sistema
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontSize: 18,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#99c9ff',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  helpText: {
    marginTop: 24,
    textAlign: 'center',
    color: '#999',
    fontSize: 13,
  },
});