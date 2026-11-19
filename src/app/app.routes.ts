import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { ArtworkDetailComponent } from './gallery/artwork-detail/artwork-detail.component';
import { ExhibitionComponent } from './exhibition/exhibition.component';


export const routes: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full' },
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  { path: 'artwork/:folder', component: ArtworkDetailComponent },
  { path: 'exhibitions/:id', component: ExhibitionComponent},
  { path: '**', redirectTo: '', pathMatch: 'full' },
  ];
