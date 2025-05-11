/**
 * Script para solucionar problemas de dependencias en la aplicación Electron
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('⚙️ Verificando instalación correcta de dependencias críticas para la aplicación Electron...');

// Lista de dependencias esenciales para el backend
const essentialDependencies = [
  'express',
  'cors',
  'openai'
];

// Verificar si están en package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Asegurar que las dependencias estén en la sección correcta
let needsUpdate = false;
essentialDependencies.forEach(dep => {
  if (!packageJson.dependencies[dep]) {
    console.log(`⚠️ Dependencia faltante en package.json: ${dep}`);
    needsUpdate = true;
  }
});

if (needsUpdate) {
  console.log('🔄 Actualizando package.json y reinstalando dependencias...');

  // Agregar dependencias faltantes
  essentialDependencies.forEach(dep => {
    if (!packageJson.dependencies[dep]) {
      // Usar versiones estables
      const versions = {
        'express': '^4.18.2',
        'cors': '^2.8.5',
        'openai': '^4.20.0'
      };
      
      packageJson.dependencies[dep] = versions[dep] || '*';
      console.log(`✅ Agregada dependencia: ${dep} ${packageJson.dependencies[dep]}`);
    }
  });

  // Actualizar configuración de electron-builder
  if (!packageJson.build.extraResources || !packageJson.build.extraResources.includes('node_modules')) {
    packageJson.build.extraResources = packageJson.build.extraResources || [];
    if (!packageJson.build.extraResources.includes('node_modules')) {
      packageJson.build.extraResources.push('node_modules');
    }
    console.log('✅ Configurada la inclusión de node_modules en build');
  }

  // Establecer asar en false para evitar problemas con módulos nativos
  if (packageJson.build.asar !== false) {
    packageJson.build.asar = false;
    console.log('✅ Desactivado asar para evitar problemas con módulos nativos');
  }

  // Guardar cambios
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
}

console.log('🔄 Instalando dependencias...');
try {
  execSync('npm install', { stdio: 'inherit' });
  
  // Asegurar dependencias críticas con install directo
  essentialDependencies.forEach(dep => {
    try {
      console.log(`🔄 Verificando instalación especial de ${dep}...`);
      execSync(`npm install ${dep} --no-save`, { stdio: 'inherit' });
    } catch (err) {
      console.error(`❌ Error instalando ${dep}: ${err.message}`);
    }
  });
  
  console.log('✅ Todas las dependencias se instalaron correctamente.');
} catch (err) {
  console.error('❌ Error al instalar dependencias:', err.message);
}

console.log('🔄 Verificando disponibilidad de módulos críticos...');
essentialDependencies.forEach(dep => {
  try {
    require.resolve(dep);
    console.log(`✅ Módulo ${dep} disponible y accesible.`);
  } catch (err) {
    console.error(`❌ No se puede resolver el módulo ${dep}, instalando manualmente...`);
    try {
      execSync(`npm install ${dep} --force`, { stdio: 'inherit' });
      console.log(`🛠️ Intentando resolver ${dep} nuevamente...`);
      try {
        require.resolve(dep);
        console.log(`✅ ¡Módulo ${dep} ahora disponible!`);
      } catch (e) {
        console.error(`❌ Todavía no se puede resolver ${dep}: ${e.message}`);
      }
    } catch (e) {
      console.error(`❌ Error instalando ${dep} manualmente: ${e.message}`);
    }
  }
});

console.log('✅ Preparación de dependencias completada.'); 