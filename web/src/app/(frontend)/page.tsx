import type { Metadata } from 'next'
import Link from 'next/link'

import { ProjectAtlas } from '@/components/ProjectWorld/ProjectAtlas'
import { queryProjects } from './projects/queries'

export const metadata: Metadata = {
  title: 'Гоньба — живые проекты Вятской земли',
  description:
    'Места, люди, ремёсла и маршруты Малмыжской земли. Выберите проект и сразу войдите в его жизнь.',
}

// Главная зависит от живого набора проектов и должна приезжать со свежим CSS/контентом.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const projects = (await queryProjects()).filter((project) => project.showInOrbit !== false)

  return (
    <main className="world-home">
      <header className="world-home__intro container">
        <p className="world-home__kicker">Малмыжская земля · Вятский край</p>
        <h1 aria-label="Гоньба — место, где проекты живут рядом">
          <span>ГОНЬБА</span>
          <em>проекты, в которые можно войти</em>
        </h1>
        <div className="world-home__lead">
          <p>
            Не каталог и не витрина. Это карта живых мест: выбирайте проект и сразу смотрите его новости,
            фотографии, предложения и контакты.
          </p>
          <Link href="/projects" className="world-home__all">Все проекты одним списком →</Link>
        </div>
      </header>

      <section className="container" aria-label="Проекты Гоньбы">
        <ProjectAtlas projects={projects} />
      </section>
    </main>
  )
}
