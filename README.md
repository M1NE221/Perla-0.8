# Perla - Asistente Inteligente de Ventas

Perla es una aplicación de escritorio minimalista con IA que ayuda a pequeños comerciantes a registrar y analizar sus ventas de manera sencilla e intuitiva.

## Características principales

- **Registro de ventas por voz o texto**: Registra tus ventas hablando o escribiendo en lenguaje natural
- **Interfaz minimalista**: Experiencia de usuario simplificada sin distracciones
- **Procesamiento de lenguaje natural**: Entiende frases como "vendí 2 kiwis a 5000"
- **Entrada por voz**: Convierte audio en texto para registrar ventas sin usar el teclado
- **Verificación de datos**: Solicita aclaraciones cuando la información está incompleta
- **Formato flexible**: Acepta diferentes formatos de entrada para productos, cantidades y precios
- **Análisis de ventas**: Proporciona insights sobre tendencias y patrones de ventas
- **Aplicación de escritorio**: Disponible para Windows y macOS

## Requisitos previos

- Node.js (v16 o superior)
- npm (v7 o superior)
- Claves de API de OpenAI (para procesamiento de lenguaje y transcripción)

## Configuración del proyecto

1. Clona el repositorio
```bash
git clone [url-del-repositorio]
cd Perla
```

2. Instala las dependencias
```bash
npm install
```

3. Configura las variables de entorno
   - Crea un archivo `.env` en la raíz del proyecto
   - Añade tu clave de API de OpenAI
```
OPENAI_API_KEY=tu_clave_api_aquí
```

## Ejecutar en modo desarrollo

Para ejecutar la aplicación en modo desarrollo:

```bash
# Ejecutar solo la aplicación web
npm run dev

# Ejecutar como aplicación de escritorio (Electron)
npm run electron:dev
```

## Compilar para producción

### Windows
```bash
npm run package:win
```
El instalador y la versión portable se generarán en la carpeta `release`.

### macOS
```bash
npm run package:mac
```
La aplicación empaquetada se generará en la carpeta `release`.

### Ambas plataformas
```bash
npm run package:all
```

## Estructura del proyecto

- `/electron` - Código principal de Electron
- `/src` - Código fuente de la aplicación
  - `/app` - Componentes principales de la aplicación Next.js
  - `/components` - Componentes de UI reutilizables
  - `/services` - Servicios para integración con IA y lógica de negocio
- `/public` - Activos estáticos (iconos, imágenes)
- `/backend_railway` - Servidor backend para procesamiento con OpenAI

## Problemas conocidos y en proceso de solución

1. **Fecha incorrecta en registros de ventas**
   - Problema: La aplicación usaba fechas hardcodeadas en algunos lugares
   - Solución aplicada: Se modificó para usar `new Date().toISOString().split('T')[0]`
   - Estado: Pendiente de verificación completa

2. **Error 404 en endpoint de insights**
   - Problema: El endpoint `/insights` no existía en el backend
   - Solución aplicada: Se implementó el endpoint en `backend_railway/backend.js`
   - Estado: Pendiente de verificación completa

3. **Verificación de ventas muestra 0**
   - Problema: La verificación después del timeout no muestra el conteo correcto
   - Solución propuesta: Revisar el mecanismo de cache o la lógica de conteo
   - Estado: Pendiente de implementación

4. **Múltiples archivos de iconos redundantes**
   - Problema: Existen archivos de iconos duplicados en varios directorios
   - Solución parcial: Se eliminaron algunos archivos redundantes
   - Estado: Requiere optimización adicional

## Tareas pendientes

- Añadir manejo de errores más robusto para todos los endpoints de API
- Implementar registro (logging) más detallado a lo largo de la aplicación
- Agregar pruebas para verificar el manejo de fechas y endpoints de API
- Optimizar la gestión de iconos para reducir el tamaño del proyecto

## Infraestructura externa

La aplicación utiliza un backend alojado en Railway para procesar las solicitudes de OpenAI:
- Endpoint: `https://perla-backend-production-6e4d.up.railway.app`
- Endpoints disponibles:
  - `/ask` - Para procesamiento de lenguaje natural
  - `/transcribe` - Para transcripción de audio
  - `/insights` - Para generar análisis de datos de ventas
  - `/health` - Para verificar el estado del servidor

## Licencia

Privada - Todos los derechos reservados - Perla Team 