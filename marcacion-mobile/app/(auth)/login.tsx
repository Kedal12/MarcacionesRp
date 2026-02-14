import { verificarDocumento } from '@/src/api/auth';
import { useAuth } from '@/src/auth/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function LoginScreen() {
  const { loginWithFace } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  
  const [documento, setDocumento] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  // PASO 1: Verificar documento y permisos
  const handleVerifyDocument = async () => {
    const docTrimmed = documento.trim();
    if (!docTrimmed) {
      Alert.alert('Campo requerido', 'Ingresa tu número de documento.');
      return;
    }

    setLoading(true);
    try {
      // Validar si el usuario existe y tiene biometría en el backend
      await verificarDocumento(docTrimmed);
      
      // Solicitar permisos de cámara
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permiso denegado', 'Se requiere acceso a la cámara para el login facial.');
        return;
      }

      setShowCamera(true);
    } catch (err: any) {
      const message = err?.response?.data?.mensaje || 'Documento no registrado o sin biometría.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  // PASO 2: Capturar foto y realizar Login Facial
  const handleFaceLogin = async () => {
    if (!cameraRef.current) return;

    setProcessingPhoto(true);
    try {
      console.log('[Login] Capturando foto...');
      
      // Capturar imagen - configuración optimizada para iOS y Android
      const photo = await cameraRef.current.takePictureAsync({
        base64: false, // No pedimos base64 directamente, lo haremos después de procesar
        quality: 0.7,
        skipProcessing: false, // Importante para iOS
        exif: false,
      });

      console.log('[Login] Foto capturada:', {
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
      });

      // ✅ IMPORTANTE: Procesar la imagen para corregir orientación y reducir tamaño
      // Esto es especialmente necesario para iPhone
      const processedPhoto = await ImageManipulator.manipulateAsync(
        photo.uri,
        [
          // Redimensionar a un tamaño manejable (máx 800px de ancho)
          { resize: { width: 800 } },
        ],
        {
          compress: 0.7, // Comprimir al 70%
          format: ImageManipulator.SaveFormat.JPEG, // Forzar JPEG (no HEIC)
          base64: true, // Ahora sí pedimos base64
        }
      );

      console.log('[Login] Foto procesada:', {
        width: processedPhoto.width,
        height: processedPhoto.height,
        base64Length: processedPhoto.base64?.length || 0,
      });

      if (processedPhoto.base64) {
        console.log('[Login] Enviando foto al servidor...');
        await loginWithFace(documento.trim(), processedPhoto.base64);
        setShowCamera(false);
        console.log('[Login] Login exitoso!');
      } else {
        throw new Error('No se pudo procesar la imagen');
      }
    } catch (err: any) {
      console.error('[Login] Error:', err);
      const message = err?.response?.data?.mensaje || err?.message || 'Error en el reconocimiento facial.';
      Alert.alert('Autenticación fallida', message);
    } finally {
      setProcessingPhoto(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="person-circle-outline" size={100} color="#007AFF" />
        </View>
        
        <Text style={styles.title}>Marcación</Text>
        <Text style={styles.subtitle}>Ingresa tu documento para el escaneo facial</Text>

        <View style={styles.inputContainer}>
          <Ionicons name="card-outline" size={22} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Número de documento"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={documento}
            onChangeText={setDocumento}
            maxLength={15}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerifyDocument}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading && !showCamera ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Iniciar Escaneo Facial</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.helpText}>
          Asegúrate de estar en un lugar iluminado para el reconocimiento.
        </Text>
        
        {/* Indicador de plataforma para debug */}
        <Text style={styles.platformText}>
          {Platform.OS === 'ios' ? '📱 iPhone' : '🤖 Android'}
        </Text>
      </View>

      {/* MODAL DE CÁMARA */}
      <Modal visible={showCamera} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView 
            style={styles.camera} 
            facing="front" 
            ref={cameraRef}
          >
            <View style={styles.overlay}>
              <View style={styles.faceGuide} />
              <Text style={styles.cameraInstruction}>
                {processingPhoto 
                  ? 'Procesando foto...' 
                  : 'Ubica tu rostro dentro del recuadro'}
              </Text>
              
              <View style={styles.cameraButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => setShowCamera(false)}
                  disabled={processingPhoto}
                >
                  <Text style={[styles.cancelText, processingPhoto && { opacity: 0.5 }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.captureButton, processingPhoto && styles.captureButtonDisabled]} 
                  onPress={handleFaceLogin}
                  disabled={processingPhoto}
                >
                  {processingPhoto ? (
                    <ActivityIndicator color="#007AFF" size="large" />
                  ) : (
                    <View style={styles.captureInner} />
                  )}
                </TouchableOpacity>
                
                {/* Espacio para balancear el layout */}
                <View style={{ width: 80 }} />
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  innerContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  iconContainer: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', color: '#1a1a1a' },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 40, marginTop: 10 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
    elevation: 2,
  },
  inputIcon: { paddingLeft: 16 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 16, fontSize: 18, color: '#333' },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  buttonDisabled: { backgroundColor: '#99c9ff' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  helpText: { marginTop: 24, textAlign: 'center', color: '#999', fontSize: 13 },
  platformText: { marginTop: 8, textAlign: 'center', color: '#ccc', fontSize: 11 },
  // Estilos Cámara
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  faceGuide: {
    width: 250,
    height: 320,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 150,
    backgroundColor: 'transparent',
  },
  cameraInstruction: { color: '#fff', fontSize: 16, marginTop: 20, fontWeight: '600', textAlign: 'center' },
  cameraButtons: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: '#ccc',
  },
  captureInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  cancelButton: { padding: 10 },
  cancelText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
