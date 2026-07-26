import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Plus, Trash2 } from 'lucide-react';

export default function CSVGridEditor({ content, onChange }) {
  const [grid, setGrid] = useState([['']]);

  useEffect(() => {
    if (content) {
      Papa.parse(content, {
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setGrid(results.data);
          }
        }
      });
    } else {
      setGrid([['']]);
    }
  }, [content]);

  const updateCell = (rowIndex, colIndex, value) => {
    const newGrid = [...grid];
    newGrid[rowIndex] = [...newGrid[rowIndex]];
    newGrid[rowIndex][colIndex] = value;
    setGrid(newGrid);
    
    // Unparse and trigger change
    const csv = Papa.unparse(newGrid);
    onChange(csv);
  };

  const addRow = () => {
    const cols = grid[0] ? grid[0].length : 1;
    const newGrid = [...grid, Array(cols).fill('')];
    setGrid(newGrid);
    onChange(Papa.unparse(newGrid));
  };

  const addColumn = () => {
    const newGrid = grid.map(row => [...row, '']);
    setGrid(newGrid);
    onChange(Papa.unparse(newGrid));
  };

  const deleteRow = (rowIndex) => {
    if (grid.length <= 1) return;
    const newGrid = grid.filter((_, i) => i !== rowIndex);
    setGrid(newGrid);
    onChange(Papa.unparse(newGrid));
  };

  const deleteColumn = (colIndex) => {
    if (grid[0].length <= 1) return;
    const newGrid = grid.map(row => row.filter((_, i) => i !== colIndex));
    setGrid(newGrid);
    onChange(Papa.unparse(newGrid));
  };

  return (
    <div style={{ padding: '1rem', overflow: 'auto' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button onClick={addRow} style={{ padding: '0.4rem 0.75rem', background: 'var(--panel-bg)', color: 'var(--text-primary)', border: '1px solid var(--panel-border)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Plus size={14} /> Add Row
        </button>
        <button onClick={addColumn} style={{ padding: '0.4rem 0.75rem', background: 'var(--panel-bg)', color: 'var(--text-primary)', border: '1px solid var(--panel-border)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Plus size={14} /> Add Column
        </button>
      </div>

      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: '0.25rem', border: '1px solid var(--panel-border)', background: 'var(--sidebar-hover)', color: 'var(--text-primary)' }}></th>
            {grid[0] && grid[0].map((_, cIndex) => (
              <th key={cIndex} style={{ padding: '0.25rem', border: '1px solid var(--panel-border)', background: 'var(--sidebar-hover)', color: 'var(--text-primary)', minWidth: '100px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Col {cIndex + 1}</span>
                  <Trash2 size={12} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => deleteColumn(cIndex)} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, rIndex) => (
            <tr key={rIndex}>
              <td style={{ padding: '0.25rem', border: '1px solid var(--panel-border)', background: 'var(--sidebar-hover)', textAlign: 'center' }}>
                <Trash2 size={12} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => deleteRow(rIndex)} />
              </td>
              {row.map((cell, cIndex) => (
                <td key={cIndex} style={{ padding: '0', border: '1px solid var(--panel-border)' }}>
                  <input
                    value={cell}
                    onChange={(e) => updateCell(rIndex, cIndex, e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)' }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
