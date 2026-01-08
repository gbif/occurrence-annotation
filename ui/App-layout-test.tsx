export default function App() {
  return (
    <div className="h-screen flex flex-col">
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-green-600 rounded flex items-center justify-center text-white text-xs font-bold">
              G
            </div>
            <h1 className="text-green-700">Rules</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-2xl">
            <p>Species Selector would go here</p>
          </div>
          <p className="text-gray-600 text-sm">Create rules that will apply to past and future occurrence records</p>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-white border-r flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <div className="p-4 border-b">
              <p>Saved Polygons component would go here</p>
            </div>
            <div className="p-4 border-b">
              <p>Annotation Rules component would go here</p>
            </div>
          </div>
        </aside>

        <main className="flex-1 bg-gray-100 flex items-center justify-center">
          <p>Map component would go here</p>
        </main>
      </div>
    </div>
  );
}