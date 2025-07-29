import React, { useState } from 'react'
import { seedDatabase, clearDatabase } from '../utils/seedData'

const DatabaseSeeder = () => {
  const [isSeeding, setIsSeeding] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [logs, setLogs] = useState<string[]>([])

  // Override console.log to capture seeding logs
  const originalLog = console.log
  const captureLog = (message: string) => {
    setLogs(prev => [...prev, message])
    originalLog(message)
  }

  const handleSeedDatabase = async () => {
    setIsSeeding(true)
    setLogs([])
    setStatus('Starting database seeding...')
    
    // Temporarily override console.log
    console.log = captureLog
    
    try {
      const success = await seedDatabase()
      if (success) {
        setStatus('✅ Database seeding completed successfully! 🔒 IMPORTANT: Run "npm run db:restore-rules" to restore security.')
      } else {
        setStatus('❌ Database seeding failed. Check console for details.')
      }
    } catch (error) {
      setStatus(`❌ Error: ${error}`)
      console.error('Seeding error:', error)
    } finally {
      console.log = originalLog
      setIsSeeding(false)
    }
  }

  const handleClearDatabase = async () => {
    if (!window.confirm('⚠️ This will permanently delete all data. Are you sure?')) {
      return
    }

    setIsClearing(true)
    setLogs([])
    setStatus('Clearing database...')
    
    console.log = captureLog
    
    try {
      await clearDatabase()
      setStatus('✅ Database cleared successfully!')
    } catch (error) {
      setStatus(`❌ Error clearing database: ${error}`)
      console.error('Clear error:', error)
    } finally {
      console.log = originalLog
      setIsClearing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              🔥 Firebase Database Seeder
            </h1>
            <p className="text-gray-600 text-lg">
              Populate your database with realistic mock data for the intelligent search system
            </p>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                <strong>📋 First time?</strong> Run <code className="bg-yellow-100 px-1 rounded">npm run db:seed-browser-setup</code> in terminal first
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Seed Database Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-6 border border-green-200">
              <h3 className="text-xl font-semibold text-green-800 mb-3">🌱 Seed Database</h3>
              <p className="text-green-700 mb-4">
                Add realistic mock data to showcase the intelligent search features:
              </p>
              <ul className="text-sm text-green-600 mb-6 space-y-1">
                <li>• 15 users with preferences</li>
                <li>• 75 places across SF</li>
                <li>• 30 curated lists</li>
                <li>• 100 user posts</li>
                <li>• AI-generated preferences</li>
              </ul>
              <button
                onClick={handleSeedDatabase}
                disabled={isSeeding || isClearing}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                  isSeeding 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                {isSeeding ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Seeding Database...
                  </div>
                ) : (
                  '🚀 Seed Database'
                )}
              </button>
            </div>

            {/* Clear Database Card */}
            <div className="bg-gradient-to-br from-red-50 to-rose-100 rounded-xl p-6 border border-red-200">
              <h3 className="text-xl font-semibold text-red-800 mb-3">🗑️ Clear Database</h3>
              <p className="text-red-700 mb-4">
                Remove all existing data from the database:
              </p>
              <ul className="text-sm text-red-600 mb-6 space-y-1">
                <li>• Deletes all users</li>
                <li>• Deletes all places</li>
                <li>• Deletes all lists</li>
                <li>• Deletes all posts</li>
                <li>• ⚠️ This action is irreversible</li>
              </ul>
              <button
                onClick={handleClearDatabase}
                disabled={isSeeding || isClearing}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                  isClearing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                {isClearing ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Clearing Database...
                  </div>
                ) : (
                  '⚠️ Clear Database'
                )}
              </button>
            </div>
          </div>

          {/* Status */}
          {status && (
            <div className={`p-4 rounded-lg mb-6 ${
              status.includes('✅') 
                ? 'bg-green-100 text-green-800 border border-green-300' 
                : status.includes('❌') 
                ? 'bg-red-100 text-red-800 border border-red-300'
                : 'bg-blue-100 text-blue-800 border border-blue-300'
            }`}>
              <p className="font-medium">{status}</p>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h4 className="font-semibold text-gray-800 mb-3">📋 Progress Log</h4>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="text-sm font-mono text-gray-600 bg-white p-2 rounded">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-3">📚 Complete Setup Process</h4>
            <div className="space-y-3 text-blue-700">
              <div className="flex items-start">
                <span className="text-lg mr-3">1️⃣</span>
                <div>
                  <strong>Setup (First Time Only):</strong>
                  <p className="text-sm">Run <code className="bg-blue-100 px-1 rounded">npm run db:seed-browser-setup</code> in terminal</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-lg mr-3">2️⃣</span>
                <div>
                  <strong>Seed Database:</strong>
                  <p className="text-sm">Click "🚀 Seed Database" button above</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-lg mr-3">3️⃣</span>
                <div>
                  <strong>Restore Security:</strong>
                  <p className="text-sm">Run <code className="bg-blue-100 px-1 rounded">npm run db:restore-rules</code> after seeding</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-lg mr-3">4️⃣</span>
                <div>
                  <strong>Test Features:</strong>
                  <p className="text-sm">Try natural language search, AI discovery, and social intelligence</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-8 flex justify-center space-x-4">
            <a
              href="/search"
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              🔍 Test Search Page
            </a>
            <a
              href="/search-demo"
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              🧠 View AI Demo
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DatabaseSeeder 