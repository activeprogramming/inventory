import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tiponodo } from './tiponodo';

describe('Tiponodo', () => {
  let component: Tiponodo;
  let fixture: ComponentFixture<Tiponodo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tiponodo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Tiponodo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
