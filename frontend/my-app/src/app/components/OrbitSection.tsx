'use client';

const orbitNodes = [
  { label: 'RUST', color: '#00e5cc', delay: '0s' },
  { label: 'PYTHON', color: '#C9A84C', delay: '-2s' },
  { label: 'CUDA', color: '#00e5cc', delay: '-4s' },
  { label: 'WASM', color: '#C9A84C', delay: '-6s' },
];

export default function OrbitSection() {
  return (
    <section
      id="foss"
      className="py-32 overflow-hidden flex flex-col items-center"
      style={{ backgroundColor: '#050810' }}
    >
      <h3
        className="text-4xl mb-20"
        style={{ fontFamily: 'var(--font-bebas-neue)' }}
      >
        OPEN ARCHITECTURE
      </h3>

      <div className="relative w-80 h-80 flex items-center justify-center">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center z-20"
          style={{
            backgroundColor: 'rgba(0,229,204,0.2)',
            border: '1px solid rgba(0,229,204,0.5)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-bebas-neue)', color: '#00e5cc' }}>CORE</span>
        </div>

        {orbitNodes.map((node, i) => (
          <div
            key={i}
            className="orbit-node"
            style={
              {
                '--d': node.delay,
                '--r': '140px',
              } as React.CSSProperties
            }
          >
            <div
              className="p-3 glass-card rounded-lg text-[10px]"
              style={{ fontFamily: 'var(--font-dm-mono)', color: node.color }}
            >
              {node.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
