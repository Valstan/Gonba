import type { Metadata } from 'next'
import Link from 'next/link'

import { ProjectAtlas } from '@/components/ProjectWorld/ProjectAtlas'
import { queryProjects } from './projects/queries'

export const metadata: Metadata = {
  title: 'Гоньба — жемчужина Вятки',
  description:
    'Места, люди, ремёсла и маршруты Малмыжской земли. Выберите проект и сразу войдите в его жизнь.',
}

// Главная зависит от живого набора проектов и должна приезжать со свежим CSS/контентом.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const projects = (await queryProjects()).filter((project) => project.showInOrbit !== false)

  return (
    <main className="world-home">
      <header className="world-home__hero">
        <div className="world-home__river" aria-hidden />
        <div className="world-home__hero-content container">
          <p className="world-home__kicker">Малмыжская земля · на берегу реки Вятки</p>
          <h1 aria-label="Гоньба — жемчужина Вятки">
            <span>Гоньба</span>
            <em>жемчужина Вятки</em>
          </h1>
          <div className="world-home__lead">
            <p>
              Там, где Вятка огибает луга, рядом живут гостевые дома, ремёсла, сады, маршруты и люди.
              Выберите свой берег — и войдите в жизнь проекта.
            </p>
            <div className="world-home__actions">
              <a href="#project-atlas" className="world-home__discover">Открыть карту проектов ↓</a>
              <Link href="/projects" className="world-home__all">Все проекты списком →</Link>
            </div>
          </div>
        </div>
      </header>

      <section id="project-atlas" className="container world-home__projects" aria-label="Проекты Гоньбы">
        <div className="world-home__projects-heading">
          <p>Живые места на одном берегу</p>
          <h2>Куда отправимся?</h2>
        </div>
        <ProjectAtlas projects={projects} />
      </section>
    </main>
  )
}
