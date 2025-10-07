#!/usr/bin/env ts-node

/**
 * Scan for Google Maps/Places API usage
 * 
 * Searches src/ for:
 * - AutocompleteService
 * - PlacesService.getPlacePredictions/getDetails
 * - PlacePhoto.getUrl
 * - Maps JS loader (script tags, @googlemaps imports)
 * 
 * Outputs: docs/status/places_audit.json
 */

import * as fs from 'fs';
import * as path from 'path';

interface AuditEntry {
  file: string;
  line: number;
  symbol: string;
  kind: 'autocomplete' | 'details' | 'photo' | 'mapsLoader' | 'direct_usage' | 'optimized';
  context: string; // Surrounding code for context
}

interface AuditResult {
  timestamp: string;
  summary: {
    total_findings: number;
    by_kind: Record<string, number>;
    direct_usage_count: number;
    optimized_usage_count: number;
  };
  direct_usages: AuditEntry[]; // Direct API calls (should be migrated)
  optimized_usages: AuditEntry[]; // Uses centralized service
  findings: AuditEntry[];
}

const PATTERNS = {
  // Direct API usage (bad - should use centralized service)
  autocomplete: /new\s+(?:google\.maps\.places\.)?AutocompleteService\s*\(/gi,
  places_service: /new\s+(?:google\.maps\.places\.)?PlacesService\s*\(/gi,
  get_predictions: /\.getPlacePredictions\s*\(/gi,
  get_details: /\.getDetails\s*\(/gi,
  photo_url: /\.getUrl\s*\(/gi,
  
  // Maps JS loader
  maps_loader: /(maps\.googleapis\.com|@googlemaps\/js-api-loader|loadScript.*maps)/gi,
  
  // Optimized usage (good - uses centralized service)
  import_places_service: /from\s+['"].*\/services\/google\/places['"]/gi,
  use_get_predictions: /getPredictions\s*\(/gi,
  use_get_details: /getPlaceDetails\s*\(/gi,
  use_photo_url: /getPhotoUrl\s*\(/gi,
};

function scanFile(filePath: string): AuditEntry[] {
  const entries: AuditEntry[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    
    // Check if file imports centralized service
    const usesOptimizedService = PATTERNS.import_places_service.test(content);
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();
      
      // Skip comments
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
        return;
      }
      
      // Check for direct API usage (should be migrated)
      if (PATTERNS.autocomplete.test(line)) {
        entries.push({
          file: relativePath,
          line: lineNum,
          symbol: 'new AutocompleteService()',
          kind: 'direct_usage',
          context: trimmedLine.substring(0, 100),
        });
      }
      
      if (PATTERNS.places_service.test(line)) {
        entries.push({
          file: relativePath,
          line: lineNum,
          symbol: 'new PlacesService()',
          kind: 'direct_usage',
          context: trimmedLine.substring(0, 100),
        });
      }
      
      if (PATTERNS.get_predictions.test(line) && !line.includes('getPredictions')) {
        entries.push({
          file: relativePath,
          line: lineNum,
          symbol: 'getPlacePredictions()',
          kind: 'direct_usage',
          context: trimmedLine.substring(0, 100),
        });
      }
      
      if (PATTERNS.get_details.test(line) && !line.includes('getPlaceDetails')) {
        entries.push({
          file: relativePath,
          line: lineNum,
          symbol: 'getDetails()',
          kind: 'direct_usage',
          context: trimmedLine.substring(0, 100),
        });
      }
      
      // Check for optimized usage
      if (usesOptimizedService) {
        if (PATTERNS.use_get_predictions.test(line)) {
          entries.push({
            file: relativePath,
            line: lineNum,
            symbol: 'getPredictions()',
            kind: 'optimized',
            context: trimmedLine.substring(0, 100),
          });
        }
        
        if (PATTERNS.use_get_details.test(line)) {
          entries.push({
            file: relativePath,
            line: lineNum,
            symbol: 'getPlaceDetails()',
            kind: 'optimized',
            context: trimmedLine.substring(0, 100),
          });
        }
        
        if (PATTERNS.use_photo_url.test(line)) {
          entries.push({
            file: relativePath,
            line: lineNum,
            symbol: 'getPhotoUrl()',
            kind: 'optimized',
            context: trimmedLine.substring(0, 100),
          });
        }
      }
      
      // Check for Maps loader
      if (PATTERNS.maps_loader.test(line)) {
        entries.push({
          file: relativePath,
          line: lineNum,
          symbol: 'Maps JS Loader',
          kind: 'mapsLoader',
          context: trimmedLine.substring(0, 100),
        });
      }
    });
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error);
  }
  
  return entries;
}

function scanDirectory(dir: string, extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']): AuditEntry[] {
  let entries: AuditEntry[] = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules, dist, build
        if (!['node_modules', 'dist', 'build', '.git'].includes(item)) {
          entries = entries.concat(scanDirectory(fullPath, extensions));
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          entries = entries.concat(scanFile(fullPath));
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }
  
  return entries;
}

function generateReport(entries: AuditEntry[]): AuditResult {
  const direct_usages = entries.filter(e => e.kind === 'direct_usage');
  const optimized_usages = entries.filter(e => e.kind === 'optimized');
  
  const by_kind: Record<string, number> = {};
  entries.forEach(entry => {
    by_kind[entry.kind] = (by_kind[entry.kind] || 0) + 1;
  });
  
  return {
    timestamp: new Date().toISOString(),
    summary: {
      total_findings: entries.length,
      by_kind,
      direct_usage_count: direct_usages.length,
      optimized_usage_count: optimized_usages.length,
    },
    direct_usages,
    optimized_usages,
    findings: entries,
  };
}

// Main execution
const srcDir = path.join(process.cwd(), 'src');
const outputPath = path.join(process.cwd(), 'docs', 'status', 'places_audit.json');

console.log('🔍 Scanning for Google Maps/Places API usage...');
console.log(`Source directory: ${srcDir}`);

const entries = scanDirectory(srcDir);
const report = generateReport(entries);

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write report
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

console.log('\n✅ Audit complete!');
console.log(`📄 Report saved to: ${outputPath}`);
console.log('\n📊 Summary:');
console.log(`  Total findings: ${report.summary.total_findings}`);
console.log(`  Direct API usage (needs migration): ${report.summary.direct_usage_count}`);
console.log(`  Optimized usage: ${report.summary.optimized_usage_count}`);
console.log('\n  Breakdown by kind:');
Object.entries(report.summary.by_kind).forEach(([kind, count]) => {
  console.log(`    ${kind}: ${count}`);
});

if (report.summary.direct_usage_count > 0) {
  console.log('\n⚠️  WARNING: Found direct API usage that should be migrated to centralized service!');
  console.log('   See places_audit.json for details.');
}

process.exit(0);

