export default function TestDeployment() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="bg-green-500 text-black p-8 rounded-lg text-center">
        <h1 className="text-4xl font-bold mb-4">✓ NEW CODE DEPLOYED</h1>
        <p className="text-xl">Deployment timestamp: {new Date().toISOString()}</p>
        <p className="text-lg mt-4">If you see this, the latest changes are live!</p>
      </div>
    </div>
  )
}
