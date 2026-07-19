const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const regex = /(<span className="text-gray-600 group-hover:text-\[#a21b7e\] transition-colors">Partilhar<\/span>\s*<\/div>\s*<ChevronRight size={14} className="text-gray-300 group-hover:text-\[#a21b7e\] transition-colors" \/>\s*<\/button>)/g;

let count = 0;
content = content.replace(regex, (match) => {
  count++;
  return match + `
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Se estamos numa pasta, a variavel é folder, senao é asset
                                          const item = typeof folder !== 'undefined' ? { id: folder.id, type: 'folder', currentName: folder.name } : typeof asset !== 'undefined' ? { id: asset.id, type: asset.type, currentName: asset.name } : null;
                                          if (item) {
                                            setItemToDistribute(item);
                                            setDistributeModalOpen(true);
                                            if (typeof setActiveFolderMenuId !== 'undefined') setActiveFolderMenuId(null);
                                            if (typeof setShowMenu !== 'undefined') setShowMenu(false);
                                          }
                                        }}
                                        className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                      >
                                        <div className="flex items-center gap-3">
                                          <Share2 size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                          <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Distribuir a Cliente</span>
                                        </div>
                                      </button>`;
});

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log('Replaced', count, 'occurrences.');
