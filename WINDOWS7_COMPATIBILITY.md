# Guía de Compatibilidad de Perla con Windows 7

Este documento proporciona información sobre cómo asegurar que Perla funcione correctamente en Windows 7.

## Para Usuarios

Si estás usando Windows 7 y encuentras el error "No se encuentra el punto de entrada del procedimiento DiscardVirtualMemory en la biblioteca de vínculos dinámicos", sigue estas instrucciones:

1. **Utiliza el acceso directo específico para Windows 7**:
   - Después de instalar Perla, busca el acceso directo "Perla (Win7)" en tu escritorio o en el menú inicio.
   - Usa siempre este acceso directo para iniciar la aplicación.

2. **Si el problema persiste**:
   - Desinstala la aplicación
   - Descarga la versión específica para Windows 7 desde nuestro sitio web
   - Ejecuta el instalador con privilegios de administrador

## Para Desarrolladores

Esta aplicación ha sido modificada para ser compatible con Windows 7. Aquí están los cambios principales:

1. **Versión de Electron**: Se utiliza Electron 19.x, que es la última versión con soporte oficial para Windows 7.

2. **Launcher específico para Windows 7**: 
   - `electron/win7-compat.js` - Script que proporciona compatibilidad con Windows 7
   - `scripts/windows7-launcher.js` - Launcher que detecta la versión de Windows y aplica configuraciones adecuadas

3. **Configuración de NSIS para el instalador**:
   - Se incluye un script personalizado para crear atajos específicos para Windows 7
   - El instalador detecta la versión de Windows y aplica configuración adecuada

4. **Compilación para Windows 7**:
   - Usa `npm run package:win7` para compilar específicamente para Windows 7

## Solución de Problemas Comunes

### Error de "No se encuentra el punto de entrada"
Este error ocurre porque Windows 7 no incluye algunas APIs modernas de Windows que son utilizadas por versiones recientes de Electron. La solución es usar la versión compatible.

### Rendimiento Lento
Windows 7 tiene limitaciones de rendimiento comparado con sistemas operativos más modernos. Para mejorar el rendimiento:
- Cierra otras aplicaciones mientras usas Perla
- Asegúrate de tener al menos 4GB de RAM
- Mantén tu sistema actualizado con los últimos parches de Windows 7

### Problemas de Visualización
Si encuentras problemas con la interfaz de usuario:
- Intenta ajustar la escala de la pantalla al 100% en la configuración de Windows
- Desactiva los efectos visuales de Windows 7 para mejorar el rendimiento

## Contacto de Soporte

Si sigues teniendo problemas con Windows 7, contáctanos en:
- soporte@perla.com
- Incluye capturas de pantalla y detalles de tu sistema 