import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Mantenimientos } from './mantenimientos';

describe('Mantenimientos', () => {
  let component: Mantenimientos;
  let fixture: ComponentFixture<Mantenimientos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Mantenimientos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Mantenimientos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
